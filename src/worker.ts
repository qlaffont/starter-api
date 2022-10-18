/* eslint-disable @typescript-eslint/no-var-requires */
import * as dotenv from 'dotenv';
dotenv.config();

import { currentEnv, validateEnv } from 'env-vars-validator';
import 'reflect-metadata';
import pino from 'pino';
import { QueueScheduler, Worker } from 'bullmq';
import { PrismaClient } from '../prisma/client';
import { handleAuthQueue } from './components/auth/authQueue';

const logLevel = process.env.LOG || 'info';

// LOAD API FRAMEWORK
const logger = pino({ level: logLevel });
global.logger = logger;

try {
  validateEnv(
    {
      DATABASE_URL: { type: 'string' },
      NODE_ENV: { type: 'string' },
      REDIS_URL: { type: 'string', format: 'uri' },
    },
    {
      requiredProperties: ['DATABASE_URL', 'REDIS_URL'],
    },
  );
} catch (error: any) {
  logger.fatal(error!.toString());
  process.exit(1);
}

// DATABASE CONFIGURATION
const prisma = new PrismaClient();
global.prisma = prisma;

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

    const workers: (Worker<any, any, any> | QueueScheduler)[] = [];
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
