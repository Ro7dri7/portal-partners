/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly R2_ACCESS_KEY_ID?: string
  readonly R2_SECRET_ACCESS_KEY?: string
  readonly R2_BUCKET_NAME?: string
  readonly R2_ENDPOINT_URL?: string
  readonly MAX_FILE_SIZE?: string
  readonly ALLOWED_EXTENSIONS?: string
  readonly SESSION_SECRET?: string
  readonly ADMIN_TOKEN?: string
  readonly PGHOST?: string
  readonly PGPORT?: string
  readonly PGDATABASE?: string
  readonly PGUSER?: string
  readonly PGPASSWORD?: string
  readonly RESEND_API_KEY?: string
  readonly FROM_EMAIL?: string
  readonly PORTAL_PUBLIC_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
