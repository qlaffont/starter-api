/* eslint-disable no-var */
import { Server } from 'http';
import {
  FastifyBaseLogger,
  FastifyInstance,
  RawReplyDefaultExpression,
  RawRequestDefaultExpression,
  RawServerDefault,
  FastifyLoggerInstance,
} from 'fastify';

import { fastifySwagger } from '@fastify/swagger';
import { MercuriusPlugin } from 'mercurius';
import { socketioServer } from 'fastify-socket.io';
import { Session } from '@fastify/secure-session';
import { ZodTypeProvider } from 'fastify-type-provider-zod2';
import { createMercuriusTestClient } from 'mercurius-integration-testing';
import { PrismaClient, User } from '@prisma/client';
import { Sendim } from 'sendim';
import { env as ENV } from '../services/env';
declare global {
  namespace globalThis {
    var logger: FastifyLoggerInstance;
    var prisma: PrismaClient;
    var env: typeof ENV;
    var sendim: Sendim;
    var testServer: FastifyCustomInstance;
    var testMercuriusClient: ReturnType<typeof createMercuriusTestClient>;
  }

  interface GraphQLContext {
    user: User;
  }

  type FastifyICustom = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<Server>,
    RawReplyDefaultExpression<Server>,
    FastifyBaseLogger,
    ZodTypeProvider
  >;

  interface FastifyCustomInstance
    extends FastifyICustom,
      fastifySensible,
      fastifySwagger,
      MercuriusPlugin,
      socketioServer {}
}

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface PassportUser {
    id: string;
  }
  interface FastifyRequest {
    connectedUser?: User;
    session: Session;
  }
}
