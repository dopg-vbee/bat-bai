import { FsStore } from './storage/fsStore.ts';
import { S3Store, type S3Config } from './storage/s3Store.ts';
import type { BlobStore } from './storage/types.ts';

export const DEFAULT_ADMIN_PASSWORD = 'batbai';

interface Config {
  port: number;
  adminPassword: string;
  publicUrl?: string;
  dataDir: string;
  s3: S3Config | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const s3 = env.S3_BUCKET
    ? {
        bucket: env.S3_BUCKET,
        endpoint: env.S3_ENDPOINT || undefined,
        region: env.S3_REGION || 'auto',
        accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? '',
      }
    : null;
  if (s3 && (!s3.accessKeyId || !s3.secretAccessKey)) {
    throw new Error('S3_BUCKET đã đặt nhưng thiếu S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY');
  }
  return {
    port: Number(env.PORT) || 3000,
    adminPassword: env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    publicUrl: env.PUBLIC_URL?.replace(/\/+$/, '') || undefined,
    dataDir: env.DATA_DIR || 'data',
    s3,
  };
}

export const createStore = (config: Config): BlobStore =>
  config.s3 ? new S3Store(config.s3) : new FsStore(config.dataDir);
