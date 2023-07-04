import 'reflect-metadata';
// eslint-disable-next-line import/order
import { env } from '../src/services/env';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import { PrismaClient } from '@prisma/client';
import { fieldEncryptionMiddleware } from 'prisma-field-encryption';
import { runServer } from '../src/server';

(async () => {
  global.env = env;
  env.LOG = 'silent';

  const prisma = new PrismaClient();
  prisma.$use(fieldEncryptionMiddleware());
  global.prisma = prisma;

  global.testServer = await runServer();
  //@ts-ignore
  global.testMercuriusClient = createMercuriusTestClient(testServer);
})();
