/* eslint-disable @typescript-eslint/no-empty-function */
import { Type } from '@sinclair/typebox';
import { isPreProductionEnv, isProductionEnv } from 'env-vars-validator';
import { login, logout, refreshToken } from './authSchemas';
import AuthController from './authController';

export const AuthRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.post(
      '/login',
      {
        schema: {
          ...login,
          body: Type.Object({
            email: Type.String({ format: 'email' }),
            password: Type.String(),
          }),
        },
        ...(!(isProductionEnv() || isPreProductionEnv())
          ? {}
          : {
              config: {
                rateLimit: {
                  max: 5,
                  timeWindow: '1 minute',
                },
              },
            }),
      },
      async (req) => AuthController.login({ email: req.body.email, password: req.body.password }, req),
    );
    fastify.post(
      '/logout',
      {
        schema: logout,
      },
      AuthController.logout,
    );

    fastify.post('/refresh', { schema: refreshToken }, AuthController.refresh);

    fastify.get('/info', AuthController.getUserInfo);
  };
