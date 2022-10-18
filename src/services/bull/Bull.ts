import { Queue } from 'bullmq';

export const bullRedisConfig = { connection: process.env.REDIS_URL as string };

export enum QUEUE {
  AUTH = 'auth',
}

export enum AuthActions {
  CLEAN_EXPIRED_TOKENS = 'clean_expired_tokens',
}

export const createQueueMQ = (name) => new Queue(name, bullRedisConfig);
