import cors from "@fastify/cors";
import multipart, { Multipart, MultipartFile } from "@fastify/multipart";
import fastify from "fastify";

import { config } from "dotenv";
import { v4 as uuid } from "uuid";

import * as fs from "fs";
import * as fsPromises from "fs/promises";
import pdfkit from "pdfkit";
import { z } from "zod";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { verify } from "hcaptcha";
import { reverse } from "ramda";

config();

const app = fastify({
  logger: true,
}).withTypeProvider<TypeBoxTypeProvider>();
app.register(cors, {
  origin: "*",
});
app.register(multipart);

app.get("/", async (request, reply) => {
  return { message: "service is up!" };
});

const CaptchaRequestSchema = Type.Object({
  token: Type.String({
    minLength: 1,
  }),
});

app.post(
  "/captcha",
  { schema: { body: CaptchaRequestSchema } },
  async (req, rep) => {
    const { token } = req.body;

    const secret = process.env.HCAPTCHA_SECRET;
    if (!secret) {
      throw new Error("HCAPTCHA_SECRET is not set");
    }
    const result = await verify(secret, token);
    if (!result.success) {
      throw new Error("Captcha verification failed");
    }

    return { success: true };
  }
);

const isMultipartFile = (file: Multipart): file is MultipartFile => {
  return Object.prototype.hasOwnProperty.call(file, "file");
};

type Options = {
  layout?: "portrait" | "landscape";
};

app.post("/generate", async (req, rep) => {
  const token = req.headers["authorization"];
  if (!token) {
    rep.code(401);
    throw new Error("Authorization header is not set");
  }
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) {
    rep.code(500);
    throw new Error("Server configuration error");
  }
  const captchaResult = await verify(secret, token);
  if (!captchaResult.success) {
    rep.code(401);
    throw new Error("Captcha verification failed");
  }

  const parts = req.parts({
    limits: {
      fileSize: 50 * 1024 * 1024,
    },
  });
  const files = [];
  let rest: Options = {};
  try {
    for await (const part of parts) {
      if (isMultipartFile(part) && part.fieldname === "files") {
        const filename = uuid();
        const path = `./tmp/${filename}.jpeg`;
        files.push(path);
        const file = fs.createWriteStream(path);
        part.file.pipe(file);
      } else if (isMultipartFile(part)) {
        app.log.warn(`Unknown fieldname: ${part.fieldname}`);
      } else {
        if (part.fieldname === "layout") {
          const result = z
            .enum(["portrait", "landscape"])
            .safeParse(part.value);
          if (result.success) {
            rest.layout = result.data;
          }
        }
      }
    }
  } catch (error) {
    app.log.error(error);
    if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
      const jobs = files.map((target) =>
        fsPromises.unlink(target).catch((error) => console.error(error))
      );
      const result = await Promise.allSettled(jobs);
      const errors = result
        .filter((result) => result.status === "rejected")
        .map((result) => (result as PromiseRejectedResult).reason);
      for (const error of errors) {
        app.log.error(error);
      }
    }
    throw error;
  }
  app.log.info(rest);

  const A4Size: [number, number] = [595.28, 841.89];
  const filename = uuid() + ".pdf";
  const doc = new pdfkit({ margin: 0, size: A4Size, layout: rest.layout });
  const stream = fs.createWriteStream(filename);

  for (const [index, file] of files.entries()) {
    const size =
      rest.layout === "landscape"
        ? (reverse(A4Size) as [number, number])
        : A4Size;
    doc.image(file, 0, 0, {
      fit: size,
      align: "center",
      valign: "center",
    });

    if (files.length !== index + 1) {
      doc.addPage();
    }
  }

  doc.pipe(stream);
  const result = new Promise((resolve, reject) => {
    try {
      stream.on("finish", () => {
        const readable = fs.createReadStream(filename);
        resolve(readable);
      });
    } catch (error) {
      reject(error);
    }
  });
  doc.end();
  const readable = await result;
  const removeTargets = [...files, filename];
  const jobs = removeTargets.map((target) =>
    fsPromises.unlink(target).catch((error) => console.error(error))
  );
  const results = await Promise.allSettled(jobs);
  console.log(
    `Successfully removed ${
      results.filter((result) => result.status === "fulfilled").length
    } files`,
    `with ${
      results.filter((result) => result.status === "rejected").length
    } errors`
  );
  rep.type("application/pdf");
  rep.send(readable);
  return rep;
});

app
  .listen({
    port: 3000,
  })
  .then(() => {
    app.log.info("Server listening on port 3000");
  });
