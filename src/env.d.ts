/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly TRIP_SECRET: string;
  readonly APPS_PIN: string;
  readonly UPSTASH_REDIS_REST_URL: string;
  readonly UPSTASH_REDIS_REST_TOKEN: string;
  readonly KV_REST_API_URL: string;
  readonly KV_REST_API_TOKEN: string;
  readonly APPLICATIONS_JSON: string;
  readonly RESUME_ACADIANATEK_JSON: string;
}
