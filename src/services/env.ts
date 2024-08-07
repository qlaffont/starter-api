import 'dotenv/config';
//@ts-ignore
// eslint-disable-next-line import/no-unresolved
import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.string().default('development'),
    LOG: z.enum(['info', 'debug', 'error', 'silent', 'warning']),
    PORT: z
      .string()
      .default('3000')
      .transform((s) => parseInt(s)),

    API_URL: z.string().url(),
    CLIENT_URL: z.string().url(),

    COOKIE_SECRET: z.string().length(38),
    COOKIE_SALT: z.string().length(16),

    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),

    JWT_ACCESS_TIME: z.string(),
    JWT_REFRESH_TIME: z.string(),
    JWT_ACCESS_SECRET: z.string(),
    JWT_REFRESH_SECRET: z.string(),

    FOREST_ENV_SECRET: z.string().optional(),
    FOREST_AUTH_SECRET: z.string().optional(),

    JEST: z.string().optional(),
  },
  runtimeEnv: process.env,
});

export enum Environment {
  TEST = 'test',
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PREPRODUCTION = 'preproduction',
  PRODUCTION = 'production',
}

export const currentEnv = () =>
  (!!env.NODE_ENV && env.NODE_ENV !== undefined ? env.NODE_ENV : Environment.DEVELOPMENT)
    ?.toString()
    ?.toLowerCase()
    ?.trim();
export const isProductionEnv = () => currentEnv() === Environment.PRODUCTION;
export const isPreProductionEnv = () => currentEnv() === Environment.PREPRODUCTION;
export const isStagingEnv = () => currentEnv() === Environment.STAGING;
export const isDevelopmentEnv = () => currentEnv() === Environment.DEVELOPMENT;
export const isTestEnv = () => currentEnv() === Environment.TEST;
export const isDeployedEnv = () =>
  Object.values(Environment)
    .filter((v) => v !== Environment.TEST && v !== Environment.DEVELOPMENT)
    .indexOf(currentEnv() as Environment.STAGING) !== -1;
