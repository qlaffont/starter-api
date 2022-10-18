/* eslint-disable @typescript-eslint/no-var-requires */
import 'dotenv/config';
import { currentEnv, isDevelopmentEnv, validateEnv } from 'env-vars-validator';
import 'reflect-metadata';
import Fastify from 'fastify';
import FastifyCORS from '@fastify/cors';
import GracefulServer from '@gquittet/graceful-server';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import unifyFastifyPlugin from 'unify-fastify';
import { fastifyAuthPrismaPlugin, FastifyAuthPrismaUrlConfig } from 'fastify-auth-prisma';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';

import { PrismaClient } from '../prisma/client';

// DATABASE CONFIGURATION
const prisma = new PrismaClient();
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

  await fastify.register(unifyFastifyPlugin);

  try {
    validateEnv(
      {
        API_URL: { type: 'string', format: 'uri' },
        CLIENT_URL: { type: 'string', format: 'uri' },
        COOKIE_SECRET: { type: 'string', minLength: 38, maxLength: 38 },
        COOKIE_SALT: { type: 'string', minLength: 16, maxLength: 16 },
        DATABASE_URL: { type: 'string' },
        DISCORD_OAUTH_CLIENT_ID: { type: 'string', minLength: 2 },
        DISCORD_OAUTH_CLIENT_SECRET: { type: 'string', minLength: 2 },
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
          'DISCORD_OAUTH_CLIENT_ID',
          'DISCORD_OAUTH_CLIENT_SECRET',
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

  await fastify.register(fastifyAuthPrismaPlugin, {
    config: [
      { url: '/graphql', method: '*' },
      { url: '/auth/login', method: 'GET' },
      { url: '/auth/authorization', method: 'GET' },
      { url: '/auth/twitch/authorization', method: 'GET' },
      { url: '/auth/refresh', method: 'POST' },
      { url: '/live', method: 'GET' },
      { url: '/ready', method: 'GET' },
      ...(isDevelopmentEnv()
        ? ([
            { url: '/documentation/*', method: '*' },
            { url: '/graphiql', method: '*' },
            { url: '/graphiql/*', method: '*' },
            { url: '/graphql', method: '*' },
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
    logger.info('Connected to database');
    gracefulServer.setReady();
  } catch (e) {
    logger.fatal('Impossible to connect to database', e);
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

  if (isDevelopmentEnv()) {
    let pkg;

    try {
      pkg = require('../package.json');
    } catch (error) {
      pkg = require('../../package.json');
    }

    const softName = pkg?.name;

    fastify.register(require('@fastify/swagger'), {
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
        if (url.startsWith('/bull') || url.startsWith('/graphiql')) newSchema.hide = true;

        // Hide tag for GraphQL
        if (url === '/graphql') newSchema.tags = ['GraphQL'];

        return { schema: newSchema, url };
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
