/* eslint-disable @typescript-eslint/no-var-requires */
import 'reflect-metadata';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import GracefulServer from '@gquittet/graceful-server';
import { createAdapter } from '@socket.io/postgres-adapter';
import { Pool } from 'pg';
import { Sendim } from 'sendim';
import unifyFastifyPlugin from 'unify-fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { fastifyAuthPrismaPlugin, FastifyAuthPrismaUrlConfig } from 'fastify-auth-prisma';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { fieldEncryptionMiddleware } from 'prisma-field-encryption';
import { createAgent } from '@forestadmin/agent';
import { createSqlDataSource } from '@forestadmin/datasource-sql';

import { PrismaClient } from '@prisma/client';

// DATABASE CONFIGURATION
const prisma = new PrismaClient();
prisma.$use(fieldEncryptionMiddleware());
global.prisma = prisma;

// import { loadBullDebugger } from './services/bull/debugger';
import { loadPassport } from './services/auth/passport';
import { loadMercurius } from './services/graphql/mercurius';
import { loadRoutes } from './loaders/RESTLoader';
import { loadSocket } from './loaders/socketLoader';
import { isProductionEnv, isPreProductionEnv, isDevelopmentEnv } from './services/env';

export const runServer = async () => {
  const logLevel = env.LOG || 'info';
  // LOAD API FRAMEWORK
  const fastify = Fastify({
    logger: { level: logLevel },
    disableRequestLogging: true,
  }).withTypeProvider<TypeBoxTypeProvider>() as FastifyCustomInstance;

  const logger = fastify.log;
  global.logger = logger;

  await fastify.register(unifyFastifyPlugin, {
    hideError: isProductionEnv() || isPreProductionEnv(),
  });

  //LOAD SENDIM
  const sendim = new Sendim(logLevel as 'info');

  global.sendim = sendim;

  await fastify.register(fastifyAuthPrismaPlugin, {
    config: [
      { url: '/graphql', method: '*' },
      { url: '/auth/login', method: 'POST' },
      { url: '/auth/refresh', method: 'POST' },
      { url: '/live', method: 'GET' },
      { url: '/ready', method: 'GET' },
      ...(isDevelopmentEnv()
        ? ([
            { url: '/documentation/*', method: '*' },
            { url: '/graphiql', method: '*' },
            { url: '/graphiql/*', method: '*' },
            // { url: '/bull/*', method: '*' },
          ] as FastifyAuthPrismaUrlConfig[])
        : []),
    ],
    prisma,
    secret: env.JWT_ACCESS_SECRET as string,
  });

  const gracefulServer = GracefulServer(fastify.server);
  gracefulServer.on(GracefulServer.SHUTTING_DOWN, (err) => {
    if (err) {
      logger.debug(err);
    }
    global.prisma.$disconnect();
    logger.debug('Server is shutting down');
  });

  try {
    await prisma.$connect();
    logger.info('[PRISMA] Connected to database');
    gracefulServer.setReady();
  } catch (e) {
    logger.fatal('[PRISMA] Impossible to connect to database', e);
    process.exit(1);
  }

  // SERVER CONFIGURATION
  const port: number = env.PORT ? env.PORT : 3000;
  const origin = isDevelopmentEnv() ? true : /(myapp\.flexper\.com)$/;

  await fastify.register(FastifyCORS, {
    methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'forest-context-url',
      'Set-Cookie',
      'set-cookie',
      'Cookie',
    ],
    origin,
    credentials: true,
  });

  await fastify.register(fastifyRateLimit, {
    global: false,
  });

  if (!(isProductionEnv() || isPreProductionEnv())) {
    let pkg;

    try {
      pkg = require('../package.json');
    } catch (error) {
      pkg = require('../../package.json');
    }

    const softName = pkg?.name;

    await fastify.register(require('@fastify/swagger'), {
      mode: 'dynamic',
      exposeRoute: true,
      openapi: {
        info: {
          title: softName,
          description: `Swagger Doc for ${softName}`,
          version: pkg?.version,
        },
        host: 'localhost:' + port,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
      },
      transform: ({ schema, url }) => {
        const newSchema = { ...schema };

        // Hide debugger url to swagger
        if (url.startsWith('/graphiql')) newSchema.hide = true;

        // Hide tag for GraphQL
        if (url === '/graphql') newSchema.tags = ['GraphQL'];

        return { schema: newSchema, url };
      },
    });

    await fastify.register(require('@fastify/swagger-ui'), {
      routePrefix: '/documentation',
      uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
      },
    });

    // loadBullDebugger(fastify);
  }

  await fastify.register(require('@fastify/secure-session'), {
    secret: env.COOKIE_SECRET,
    salt: env.COOKIE_SALT,
    cookieName: 'myapp-cookies',
    cookie: {
      secure: false,
      httpOnly: true,
      path: '/',
    },
    pingInterval: 1000,
    pingTimeout: 60000,
  });

  if (!env.JEST && env.FOREST_AUTH_SECRET && env.FOREST_ENV_SECRET) {
    // TO FIX ISSUE WITH FOREST WHO USE `use` old syntax
    await fastify.register(require('@fastify/middie'));

    const url = new URL(env.DATABASE_URL!);
    const connectionObject = {
      dialect: url.protocol.split(':')[0],
      database: url.pathname.split('/')[1],
      username: url.username,
      password: url.password,
      host: url.hostname,
      port: url.port ? parseInt(url.port, 10) : undefined,
      schema: url.searchParams.get('schema') || undefined,
    };

    const agent = await createAgent({
      authSecret: env.FOREST_AUTH_SECRET!,
      envSecret: env.FOREST_ENV_SECRET!,
      isProduction: env.NODE_ENV === 'production',
      typingsPath: './typings.ts',
      typingsMaxDepth: 5,
      prefix: 'forest',
      loggerLevel: logLevel === 'debug' ? 'Debug' : 'Error',
      logger: (level, message) => {
        if (logLevel === 'debug') {
          logger[level.toLowerCase()](message);
        }
      },
    });

    //@ts-ignore
    agent.addDataSource(createSqlDataSource(connectionObject));

    await agent.mountOnFastify(fastify).start();
  }

  try {
    const pool = new Pool({
      connectionString: env.DATABASE_URL as string,
    });
    await fastify.register(require('fastify-socket.io'), {
      adapter: createAdapter(pool),
      cors: {
        allowedHeaders: [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'forest-context-url',
          'Set-Cookie',
          'set-cookie',
          'Cookie',
        ],
        origin,
        credentials: true,
      },
    });
  } catch (error) {
    logger.fatal('Impossible to connect to postgres');
  }

  loadSocket(fastify);
  loadPassport(fastify);
  await loadMercurius(fastify);
  loadRoutes(fastify);

  return fastify;
};
