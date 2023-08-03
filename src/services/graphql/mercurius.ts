import { buildSchema } from 'type-graphql';
import { mergeSchemas } from '@graphql-tools/schema';
import mercurius from 'mercurius';
// eslint-disable-next-line import/no-named-as-default
import mercuriusUpload from 'mercurius-upload';
import { unifyMercuriusErrorFormatter } from 'unify-mercurius';
import { graphQLLoaderLoader, graphQLSchemaLoader } from '../../loaders/graphQLLoader';
import { GQLEnumErrors } from '../../errors/error.type';
import { isProductionEnv, isPreProductionEnv } from '../env';
import { rateLimitDirective } from './directives/rate-limit';

export const loadMercurius = async (fastify: FastifyCustomInstance) => {
  let schema = await buildSchema({
    ...graphQLSchemaLoader(),
    orphanedTypes: [GQLEnumErrors],
    validate: { forbidUnknownValues: false },
    authChecker: ({ context }) => {
      return !!context.user;
    },
  });

  schema = mergeSchemas({
    schemas: [schema],
    typeDefs: [rateLimitDirective.typeDefs],
  });

  schema = rateLimitDirective.transformer(schema);

  fastify.register(mercuriusUpload, {
    maxFileSize: 1024 * 1024 * 5,
    maxFiles: 1,
  });

  fastify.register(mercurius, {
    schema,
    context: (req) => {
      return { user: req.connectedUser, socket: fastify.io };
    },
    ide: !(isProductionEnv() || isPreProductionEnv()),
    loaders: graphQLLoaderLoader(),
    path: '/graphql',
    errorFormatter: unifyMercuriusErrorFormatter({
      disableDetails: isProductionEnv() || isPreProductionEnv(),
    }),
  });
};
