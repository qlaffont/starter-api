import 'reflect-metadata';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import { runServer } from '../src/server';

(async () => {
  global.testServer = await runServer();
  //@ts-ignore
  global.testMercuriusClient = createMercuriusTestClient(testServer);
})();
