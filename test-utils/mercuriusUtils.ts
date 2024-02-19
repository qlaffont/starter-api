import { match } from 'tap';

export const testIfQueryIsProtected = async (mercuriusClient, gql, variables?: object) => {
  const res = await mercuriusClient.query(gql, variables);

  match(res.errors![0].message, 'Access denied!');
};

export const testIfAccessTokenIsInvalidQuery = async (mercuriusClient, gql, variables?: object) => {
  const res = await mercuriusClient.query(gql, {
    ...variables,
    headers: {
      authorization: `Bearer badToken`,
    },
  });

  match(res.errors![0].message, 'Access denied!');
};

export const testIfMutationIsProtected = async (mercuriusClient, gql, variables) => {
  const res = await mercuriusClient.mutate(gql, variables);

  match(res.errors![0].message, 'Access denied!');
};

export const testIfAccessTokenIsInvalidMutation = async (mercuriusClient, gql, variables) => {
  const res = await mercuriusClient.mutate(gql, {
    ...variables,
    headers: {
      authorization: `Bearer badToken`,
    },
  });

  match(res.errors![0].message, 'Access denied!');
};
