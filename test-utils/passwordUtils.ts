import set from 'lodash/set';
import { match } from 'tap';
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
  match(resShort.errors![0].message, 'Bad Request');
  match(resShort.errors![0].extensions, { error: AuthErrors.password_validation_error });

  const tooLong = tweakPassword('veeeerrrrryyyyyylooooooonnnnggggg');
  const resLong = await mercuriusClient.mutate(gql, tooLong);
  match(resLong.errors![0].message, 'Bad Request');
  match(resLong.errors![0].extensions, { error: AuthErrors.password_validation_error });
};
