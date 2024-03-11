import 'reflect-metadata';
import { notEqual } from 'assert';
import { User } from '@prisma/client';
import set from 'lodash/set';
import { before, after, afterEach } from '@tapjs/mocha-globals';
import { equal, match, test, capture, not, notMatch, beforeEach } from 'tap';
import { CryptoUtils } from '../../services/crypto/crypto.utils';
import {
  createUserAndGetAccessToken,
  testIfQueryIsProtected,
  testIfAccessTokenIsInvalidQuery,
  testPasswordValidation,
  DEFAULT_PASSWORD,
  testIfMutationIsProtected,
  testIfAccessTokenIsInvalidMutation,
  setupTests,
} from '../../../test-utils';
import { AuthErrors, UserRegister } from './authType';
import AuthController from './authController';

before(setupTests);

test('Auth', async () => {
  const email = 'auth-queue@test.fr';
  let user: User;
  let accessToken: string;

  before(async () => {
    const res = await createUserAndGetAccessToken({ email });
    //@ts-ignore
    user = res[0];
    //@ts-ignore
    accessToken = res[1];
    //@ts-ignore
    refreshToken = res[2];
  });

  after(async () => {
    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  });

  test('getUserMe', async () => {
    const gql = `
      {
        getUserMe {
          email
        }
      }
    `;
    const goodResponse = {
      data: {
        getUserMe: {
          email,
        },
      },
    };

    test('should return an access denied if no access token', async () => {
      await testIfQueryIsProtected(testMercuriusClient, gql);
    });

    test('should return an access denied with wrong accessToken', async () => {
      await testIfAccessTokenIsInvalidQuery(testMercuriusClient, gql);
    });

    test('should return 200 with user information', async () => {
      const res = await testMercuriusClient.query(gql, {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      match(res, goodResponse);
      equal(res?.errors, undefined);
    });
  });

  test('userRegister', async () => {
    const gql = `
      mutation($userRegister: UserRegister!) {
        registerUser(userRegister: $userRegister)
      }
    `;
    const goodVariables: UserRegister = {
      email: 'goodmail@mail.com',
      firstName: 'First',
      lastName: 'Last',
      password: 'password',
    };
    const goodResponse = {
      data: { registerUser: 'OK' },
    };

    after(async () => {
      await prisma.user.delete({
        where: {
          email: goodVariables.email,
        },
      });
    });

    // afterEach(() => jest.resetAllMocks());

    test('should create a new record in DB', async () => {
      const results = capture(global.sendim, 'sendTransactionalMail');
      const res = await testMercuriusClient.mutate(gql, {
        variables: {
          userRegister: goodVariables,
        },
      });

      const record = await prisma.user.findFirst({ where: { email: goodVariables.email } });

      match(res, goodResponse);
      match(res?.errors, undefined);
      not(record, null);
      equal(results()?.length, 1);
    });

    test('should not allow bad emails', async () => {
      const res = await testMercuriusClient.mutate(gql, {
        variables: {
          userRegister: { ...goodVariables, email: 'badmail' },
        },
      });

      notMatch(res, goodResponse);
      match(res.errors![0].message, 'Bad Request');
      match(res.errors![0].extensions, { error: AuthErrors.email_not_valid });
    });

    test('should not allow already used email', async () => {
      const res = await testMercuriusClient.mutate(gql, {
        variables: {
          userRegister: goodVariables,
        },
      });

      notMatch(res, goodResponse);
      match(res.errors![0].message, 'Bad Request');
      match(res.errors![0].extensions, { error: 'user_already_exist' });
    });

    test('should fullfil password validation', async () =>
      await testPasswordValidation(
        testMercuriusClient,
        gql,
        { userRegister: { ...goodVariables, email: 'goodmailpassword@mail.com' } },
        'userRegister.password',
      ));
  });

  test('changePassword', async () => {
    const gql = `
    mutation($oldPassword: String!, $newPassword: String!) {
      changePassword(oldPassword: $oldPassword, newPassword: $newPassword)
    }
    `;
    const goodVariables = {
      variables: {
        oldPassword: DEFAULT_PASSWORD,
        newPassword: 'newPassword',
      },
    };
    const goodResponse = {
      data: { changePassword: 'OK' },
    };

    let token;
    beforeEach(async () => {
      const res = await AuthController.loginAndGenerateToken(user, {
        //@ts-ignore
        session: {
          //@ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          set: () => {},
        },
      });

      token = res?.access_token;
    });

    afterEach(async () => {
      await prisma.user.update({
        where: { email },
        data: { password: await CryptoUtils.getArgonHash(DEFAULT_PASSWORD) },
      });
    });

    test('should return an access denied if no access token', async () => {
      await testIfMutationIsProtected(testMercuriusClient, gql, goodVariables);
    });

    test('should return an access denied with wrong accessToken', async () => {
      await testIfAccessTokenIsInvalidMutation(testMercuriusClient, gql, goodVariables);
    });

    test("should change user's password", async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });
      const beforePassword = beforeMutationUser?.password;

      const res = await testMercuriusClient.mutate(gql, {
        ...goodVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });
      const afterPassword = afterMutationUser?.password;

      match(res, goodResponse);
      equal(res?.errors, undefined);
      notEqual(beforePassword, afterPassword);
    });

    test('should not allow a wrong password', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });
      const beforePassword = beforeMutationUser?.password;

      const badVariables = set(goodVariables, 'variables.oldPassword', 'wrong');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });
      const afterPassword = afterMutationUser?.password;

      notMatch(res, goodResponse);
      match(res.errors![0].message, 'Bad Request');
      match(res.errors![0].extensions, { error: 'password_error' });
      equal(beforePassword, afterPassword);
    });
  });

  test('askResetPassword', async () => {
    const gql = `
    mutation($email: String!) {
      askResetPassword(email: $email)
    }
    `;
    const goodVariables = {
      variables: {
        email,
      },
    };
    const goodResponse = {
      data: { askResetPassword: 'OK' },
    };

    let token;
    beforeEach(async () => {
      const res = await AuthController.loginAndGenerateToken(user, {
        //@ts-ignore
        session: {
          //@ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          set: () => {},
        },
      });

      token = res?.access_token;
    });

    afterEach(async () => {
      await prisma.user.update({
        where: { email },
        data: { resetPasswordCode: null },
      });
    });

    test('create a reset code', async () => {
      const results = capture(global.sendim, 'sendTransactionalMail');
      const res = await testMercuriusClient.mutate(gql, {
        ...goodVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const record = await prisma.user.findFirst({ where: { email } });

      match(res, goodResponse);
      equal(res?.errors, undefined);
      notEqual(record?.resetPasswordCode, null);
      equal(results().length, 1);
    });

    test('should not allow an unknown account', async () => {
      const badVariables = set(goodVariables, 'variables.email', 'unknown@test.com');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const record = await prisma.user.findFirst({ where: { email } });

      notMatch(res, goodResponse);
      notEqual(res?.errors, undefined);
      match(res.errors![0].message, 'Bad Request');
      match(res.errors![0].extensions, { error: 'account_not_found' });
      equal(record?.resetPasswordCode, null);
    });
  });

  test('resetPassword', async () => {
    const gql = `
    mutation($email: String!, $resetCode: String!, $password: String!) {
      resetPassword(email: $email, resetCode: $resetCode, password: $password)
    }
    `;

    const resetCode = '1234';
    const goodVariables = {
      variables: {
        email,
        password: 'newPassword',
        resetCode,
      },
    };
    const goodResponse = {
      data: { resetPassword: 'OK' },
    };

    let token;
    beforeEach(async () => {
      const res = await AuthController.loginAndGenerateToken(user, {
        //@ts-ignore
        session: {
          //@ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          set: () => {},
        },
      });

      token = res?.access_token;

      await prisma.user.update({
        where: { email },
        data: { resetPasswordCode: resetCode },
      });
    });

    afterEach(async () => {
      await prisma.user.update({
        where: { email },
        data: { resetPasswordCode: null, password: await CryptoUtils.getArgonHash(DEFAULT_PASSWORD) },
      });
    });

    test('should reset the password', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });

      const res = await testMercuriusClient.mutate(gql, {
        ...goodVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });

      match(res, goodResponse);
      equal(res?.errors, undefined);
      equal(afterMutationUser?.resetPasswordCode, null);
      notEqual(afterMutationUser?.password, beforeMutationUser?.password);
    });

    test('should not allow a wrong reset code', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });

      const badVariables = set(goodVariables, 'variables.resetCode', '4321');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });

      notMatch(res, goodResponse);
      notEqual(res?.errors, undefined);
      match(res.errors![0].message, 'Bad Request');
      match(res.errors![0].extensions, { error: 'wrong_reset_code' });
      notEqual(afterMutationUser?.resetPasswordCode, null);
      equal(afterMutationUser?.password, beforeMutationUser?.password);
    });

    test('should not allow a wrong reset code', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });

      const badVariables = set(goodVariables, 'variables.email', 'unknown@test.fr');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });

      notMatch(res, goodResponse);
      notEqual(res?.errors, undefined);
      match(res.errors![0].message, 'Bad Request');
      match(res.errors![0].extensions, { error: 'account_not_found' });
      notEqual(afterMutationUser?.resetPasswordCode, null);
      equal(afterMutationUser?.password, beforeMutationUser?.password);
    });
  });
});
