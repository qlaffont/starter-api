// eslint-disable-next-line import/order
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import { teardown } from 'tap';
import { env } from '../src/services/env';
import { loadPrismaClient } from '../src/services/prisma/loadClient';
import { runServer } from '../src/server';

export const setupTests = async () => {
  global.env = env;
  //@ts-ignore
  env.LOG = 'silent';

  process.env.RUN_TEST = 'true';

  global.prisma = loadPrismaClient();

  global.testServer = await runServer();
  //@ts-ignore
  global.testMercuriusClient = createMercuriusTestClient(testServer);

  teardown(async () => {
    await global.testServer.close();
  });
};
