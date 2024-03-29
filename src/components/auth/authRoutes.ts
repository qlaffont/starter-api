/* eslint-disable @typescript-eslint/no-empty-function */
import z from 'zod';
import { isProductionEnv, isPreProductionEnv } from '../../services/env';
import { login, logout, refreshToken, userInfo } from './authSchemas';
import AuthController from './authController';

export const AuthRoutes = () =>
  async function (fastify: FastifyCustomInstance) {
    fastify.post(
      '/login',
      {
        schema: {
          ...login,
          body: z.object({
            email: z.string().email(),
            password: z.string(),
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

    fastify.get('/info', { schema: userInfo }, AuthController.getUserInfo);
  };
