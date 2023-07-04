import { runServer } from './server';
import { currentEnv, env, isProductionEnv } from './services/env';

(async () => {
  global.env = env;
  const logLevel = env.LOG || 'info';
  const port: number = env.PORT ? env.PORT : 3000;

  const fastify = await runServer();

  fastify.ready(async () => {
    logger.info(`Server Running on ${currentEnv()} mode`);
    logger.info(`Log Running on ${logLevel} mode`);
  });
  fastify.listen({ port, host: '::' }, (err) => {
    if (err) {
      logger.fatal(`${err}`);
      process.exit(1);
    }

    if (!isProductionEnv()) {
      logger.info('REST Documentation available in /documentation');
      logger.info('GQL Documentation available in /graphiql');
    }
  });
})();
