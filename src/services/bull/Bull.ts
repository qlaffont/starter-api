import { Queue, Worker } from 'bullmq';

const url = new URL(process.env.REDIS_URL!);

export const bullRedisConfig = {
  connection: {
    dialect: url.protocol.split(':')[0],
    database: url.pathname.split('/')[1],
    username: url.username,
    password: url.password,
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : undefined,
    schema: url.searchParams.get('schema') || undefined,
  },
};

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
