import 'reflect-metadata';

// eslint-disable-next-line import/order
import { currentEnv, env } from './services/env';
global.env = env;

import Fastify from 'fastify';
// eslint-disable-next-line import/no-named-as-default
import pino from 'pino';
import { Worker } from 'bullmq';
import { handleAuthQueue } from './components/auth/authQueue';
import { loadPrismaClient } from './services/prisma/loadClient';

const logLevel = env.LOG || 'info';

// LOAD API FRAMEWORK
const logger = pino({ level: logLevel });
global.logger = logger;

// DATABASE CONFIGURATION
global.prisma = loadPrismaClient();

(async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to database');
  } catch (e) {
    logger.fatal('Impossible to connect to database', e);
    process.exit(1);
  }
})();

(async () => {
  try {
    logger.info(`Worker Running on ${currentEnv()} mode`);

    const workers: Worker<any, any, any>[] = [];
    workers.push(...handleAuthQueue());

    ['SIGHUP', 'SIGBREAK', 'SIGINT', 'SIGTERM', 'uncaughtException', 'beforeExit', 'SIGUSR2'].map((code) => {
      process.on(code, () => {
        (async () => {
          try {
            await global.prisma.$disconnect();
            for (const worker of global.workers) {
              await worker.close();
            }
          } catch (error) {
            logger.error(error);
          }
        })();
        logger.info('Worker shutdown');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.fatal('Impossible to connect to Redis');
  }
})();

//Add port for cloud provider who need port to check health
const port: number = env.PORT ? env.PORT : 3010;

const fastify = Fastify({
  logger: { level: logLevel },
  disableRequestLogging: true,
});

fastify.ready(async () => {
  logger.info(`Server Running on ${currentEnv()} mode`);
  logger.info(`Log Running on ${logLevel} mode`);
});
fastify.listen({ port, host: '::' }, (err) => {
  if (err) {
    logger.fatal(`${err}`);
    process.exit(1);
  }
});
