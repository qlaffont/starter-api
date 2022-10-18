/* eslint-disable @typescript-eslint/no-empty-function */
import { FastifyInstance } from 'fastify';
import fastifyPassport from '@fastify/passport';
import { authorizeDiscordConnection, connectToDiscord, logout, refreshToken } from './authSchemas';
import AuthController from './authController';

export const AuthRoutes = () =>
  async function (fastify: FastifyInstance) {
    fastify.get(
      '/login',
      {
        preValidation: fastifyPassport.authenticate('discord', {
          session: false,
        }),
        schema: connectToDiscord,
      },
      () => {},
    );

    fastify.get(
      '/authorization',
      {
        preValidation: fastifyPassport.authenticate('discord', {
          failureRedirect: '/auth/login',
          session: false,
        }),
        schema: authorizeDiscordConnection,
      },
      AuthController.authorization,
    );

    fastify.post(
      '/logout',
      {
        schema: logout,
      },
      AuthController.logout,
    );

    fastify.post('/refresh', { schema: refreshToken }, AuthController.refresh);

    fastify.get('/info', { schema: { hide: true } }, AuthController.getUserInfo);
  };
