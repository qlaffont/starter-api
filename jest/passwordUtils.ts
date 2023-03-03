import { set } from 'lodash';
import { AuthErrors } from '../src/components/auth/authType';

export const testPasswordValidation = async (mercuriusClient, gql, variables, passwordPath) => {
  const tweakPassword = (value) =>
    set(
      {
        variables,
      },
      `variables.${passwordPath}`,
      value,
    );

  const tooShort = tweakPassword('short');
  const resShort = await mercuriusClient.mutate(gql, tooShort);
  expect(resShort.errors![0].message).toContain('Bad Request');
  expect(resShort.errors![0].extensions).toMatchObject({ error: AuthErrors.password_validation_error });

  const tooLong = tweakPassword('veeeerrrrryyyyyylooooooonnnnggggg');
  const resLong = await mercuriusClient.mutate(gql, tooLong);
  expect(resLong.errors![0].message).toContain('Bad Request');
  expect(resLong.errors![0].extensions).toMatchObject({ error: AuthErrors.password_validation_error });
};
