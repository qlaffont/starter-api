import { isDevelopmentEnv } from 'env-vars-validator';
import { buildSchema } from 'type-graphql-v2-fork';
import mercurius from 'mercurius';
import mercuriusUpload from 'mercurius-upload';
import { unifyMercuriusErrorFormatter } from 'unify-mercurius';
import { graphQLLoaderLoader, graphQLSchemaLoader } from '../../loaders/graphQLLoader';

export const loadMercurius = async (fastify: FastifyCustomInstance) => {
  const schema = await buildSchema({
    ...graphQLSchemaLoader(),
    authChecker: ({ context }) => {
      return !!context.user;
    },
  });

  fastify.register(mercuriusUpload, {
    maxFileSize: 1024 * 1024 * 5,
    maxFiles: 1,
  });

  fastify.register(mercurius, {
    schema,
    context: (req) => {
      return { user: req.connectedUser, socket: fastify.io };
    },
    ide: isDevelopmentEnv(),
    loaders: graphQLLoaderLoader(),
    path: '/graphql',
    errorFormatter: unifyMercuriusErrorFormatter(),
  });
};
