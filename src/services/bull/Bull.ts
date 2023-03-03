import { Queue, Worker } from 'bullmq';

export const bullRedisConfig = { connection: process.env.REDIS_URL as string };

export enum QUEUE {
  AUTH = 'auth',
}

export enum AuthActions {
  CLEAN_EXPIRED_TOKENS = 'clean_expired_tokens',
}
//@ts-ignore
export const createQueueMQ = (name) => new Queue(name, bullRedisConfig);

//@ts-ignore
export const createWorkerMQ = <T, X, Y>(name, fct) => new Worker<T, X, Y>(name, fct, bullRedisConfig);
