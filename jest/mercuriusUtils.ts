export const testIfQueryIsProtected = async (mercuriusClient, gql, variables?: object) => {
  const res = await mercuriusClient.query(gql, variables);

  expect(res.errors![0].message).toContain('Access denied!');
};

export const testIfAccessTokenIsInvalidQuery = async (mercuriusClient, gql, variables?: object) => {
  const res = await mercuriusClient.query(gql, {
    ...variables,
    headers: {
      authorization: `Bearer badToken`,
    },
  });

  expect(res.errors![0].message).toContain('Access denied!');
};

export const testIfMutationIsProtected = async (mercuriusClient, gql, variables) => {
  const res = await mercuriusClient.mutate(gql, variables);

  expect(res.errors![0].message).toContain('Access denied!');
};

export const testIfAccessTokenIsInvalidMutation = async (mercuriusClient, gql, variables) => {
  const res = await mercuriusClient.mutate(gql, {
    ...variables,
    headers: {
      authorization: `Bearer badToken`,
    },
  });

  expect(res.errors![0].message).toContain('Access denied!');
};
