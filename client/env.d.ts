/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  readonly VITE_API_SERVER_URL: string | undefined;
  readonly VITE_SITE_KEY: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
