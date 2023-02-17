/* eslint-disable @typescript-eslint/no-var-requires */
import 'dotenv/config';
import { currentEnv, isDevelopmentEnv, isPreProductionEnv, isProductionEnv, validateEnv } from 'env-vars-validator';
import 'reflect-metadata';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import GracefulServer from '@gquittet/graceful-server';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { Sendim } from 'sendim';
import unifyFastifyPlugin from 'unify-fastify';
import fastifyRateLimit from '@fastify/rate-limit';
import { fastifyAuthPrismaPlugin, FastifyAuthPrismaUrlConfig } from 'fastify-auth-prisma';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { fieldEncryptionMiddleware } from 'prisma-field-encryption';

import { PrismaClient } from '@prisma/client';

// DATABASE CONFIGURATION
const prisma = new PrismaClient();
prisma.$use(fieldEncryptionMiddleware());
global.prisma = prisma;

import { loadBullDebugger } from './services/bull/debugger';
import { loadPassport } from './services/auth/passport';
import { loadMercurius } from './services/graphql/mercurius';
import { loadRoutes } from './loaders/RESTLoader';
import { loadSocket } from './loaders/socketLoader';

(async () => {
  const logLevel = process.env.LOG || 'info';
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

  try {
    validateEnv(
      {
        API_URL: { type: 'string', format: 'uri' },
        CLIENT_URL: { type: 'string', format: 'uri' },
        COOKIE_SECRET: { type: 'string', minLength: 38, maxLength: 38 },
        COOKIE_SALT: { type: 'string', minLength: 16, maxLength: 16 },
        DATABASE_URL: { type: 'string' },
        NODE_ENV: { type: 'string' },
        PORT: { type: 'integer' },
        JWT_ACCESS_TIME: { type: 'string' },
        JWT_REFRESH_TIME: { type: 'string' },
        JWT_ACCESS_SECRET: { type: 'string' },
        JWT_REFRESH_SECRET: { type: 'string' },
        REDIS_URL: { type: 'string', format: 'uri' },
      },
      {
        requiredProperties: [
          'COOKIE_SECRET',
          'COOKIE_SALT',
          'API_URL',
          'CLIENT_URL',
          'JWT_ACCESS_TIME',
          'JWT_REFRESH_TIME',
          'JWT_REFRESH_SECRET',
          'JWT_ACCESS_SECRET',
          'REDIS_URL',
          'DATABASE_URL',
        ],
      },
    );
  } catch (error: any) {
    logger.fatal(error!.toString());
    process.exit(1);
  }

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
            { url: '/bull/*', method: '*' },
          ] as FastifyAuthPrismaUrlConfig[])
        : []),
    ],
    prisma,
    secret: process.env.JWT_ACCESS_SECRET as string,
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
  const port: number = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const origin = isDevelopmentEnv() ? true : /(myapp\.flexper\.com)$/;

  await fastify.register(FastifyCORS, {
    methods: ['GET', 'PUT', 'DELETE', 'POST', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
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

    loadBullDebugger(fastify);
  }

  await fastify.register(require('@fastify/secure-session'), {
    secret: process.env.COOKIE_SECRET,
    salt: process.env.COOKIE_SALT,
    cookieName: 'myapp-cookies',
    cookie: {
      secure: false,
      httpOnly: true,
      path: '/',
    },
    pingInterval: 1000,
    pingTimeout: 60000,
  });

  try {
    const onRedisError = () => {
      logger.fatal('Impossible to connect to Redis');
      process.exit(1);
    };
    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();
    pubClient.on('error', onRedisError);
    subClient.on('error', onRedisError);

    await Promise.all([pubClient.connect(), subClient.connect()]);

    await fastify.register(require('fastify-socket.io'), {
      adapter: createAdapter(pubClient, subClient),
      cors: {
        allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
        origin,
        credentials: true,
      },
    });
  } catch (error) {
    logger.fatal('Impossible to connect to Redis');
  }

  loadSocket(fastify);
  loadPassport(fastify);
  await loadMercurius(fastify);
  loadRoutes(fastify);

  fastify.ready(async () => {
    logger.info(`Server Running on ${currentEnv()} mode`);
    logger.info(`Log Running on ${logLevel} mode`);
  });

  fastify.listen({ port, host: '::' }, (err) => {
    if (err) {
      logger.fatal(`${err}`);
      process.exit(1);
    }

    if (isDevelopmentEnv()) {
      logger.info('REST Documentation available in /documentation');
      logger.info('GQL Documentation available in /graphiql');
      logger.info('Bull Debugger available in /bull');
    }
  });
})();
