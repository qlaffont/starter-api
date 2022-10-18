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
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { PrismaClient, User } from '../../prisma/client';

declare global {
  namespace globalThis {
    var logger: FastifyLoggerInstance;
    var prisma: PrismaClient;
  }

  interface GraphQLContext {
    user: User;
  }

  type FastifyICustom = FastifyInstance<
    RawServerDefault,
    RawRequestDefaultExpression<Server>,
    RawReplyDefaultExpression<Server>,
    FastifyBaseLogger,
    TypeBoxTypeProvider
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
