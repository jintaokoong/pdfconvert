import cors from "@fastify/cors";
import multipart, {
  Multipart,
  MultipartFile,
  SavedMultipartFile,
} from "@fastify/multipart";
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
import { ap, reverse } from "ramda";
import { fastifyMultipart } from "@fastify/multipart";

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

app.addHook("preHandler", async (req, rep) => {
  if (req.url === "/generate") {
    const token = req.headers["authorization"];
    if (!token) {
      rep.code(401);
      throw new Error("Authorization header is not set");
    }
    const secret = process.env.HCAPTCHA_SECRET;
    if (!secret) {
      rep.code(500);
      throw new Error("Server not configured properly");
    }
    const result = await verify(secret, token);
    if (!result.success) {
      rep.code(401);
      throw new Error("Captcha verification failed");
    }
  }
  return;
});

app.addHook("onSend", async (req, rep) => {
  rep.header("x-api-version", "1.0.1");
  return;
});

app.post("/generate", async (req, rep) => {
  const parts = req.parts();
  let rest: Options = {};
  const files = await req.saveRequestFiles({
    limits: {
      fileSize: 20 * 1024 * 1024,
    },
  });
  for await (const part of parts) {
    if (!isMultipartFile(part) && part.fieldname === "layout") {
      const result = z.enum(["portrait", "landscape"]).safeParse(part.value);
      if (result.success) {
        rest.layout = result.data;
      }
    } else if (!isMultipartFile(part)) {
      app.log.warn(`Unknown field ${part.fieldname}`);
    }
  }

  const A4Size: [number, number] = [595.28, 841.89];
  const filename = uuid() + ".pdf";
  const doc = new pdfkit({ margin: 0, size: A4Size, layout: rest.layout });
  const stream = fs.createWriteStream(filename);

  for (const [index, file] of files.entries()) {
    const size =
      rest.layout === "landscape"
        ? (reverse(A4Size) as [number, number])
        : A4Size;
    doc.image(file.filepath, 0, 0, {
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
  await fsPromises.unlink(filename);
  rep.type("application/pdf");
  rep.send(readable);
  return rep;
});

app
  .listen({
    host: "::",
    port: Number(process.env.PORT) || 3000,
  })
  .then((addr) => {
    app.log.info(`Server listening on ${addr}`);
  });
