import 'reflect-metadata';
// eslint-disable-next-line import/order
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import { env } from '../src/services/env';
import { loadPrismaClient } from '../src/services/prisma/loadClient';
import { runServer } from '../src/server';

(async () => {
  global.env = env;
  //@ts-ignore
  env.LOG = 'silent';

  global.prisma = loadPrismaClient();

  global.testServer = await runServer();
  //@ts-ignore
  global.testMercuriusClient = createMercuriusTestClient(testServer);
})();
