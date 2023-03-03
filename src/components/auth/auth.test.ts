import { User } from '@prisma/client';
import { set } from 'lodash';
import { CryptoUtils } from '../../services/crypto/crypto.utils';
import { AuthErrors, UserRegister } from './authType';
import AuthController from './authController';
import {
  createUserAndGetAccessToken,
  testIfQueryIsProtected,
  testIfAccessTokenIsInvalidQuery,
  testPasswordValidation,
  DEFAULT_PASSWORD,
  testIfMutationIsProtected,
  testIfAccessTokenIsInvalidMutation,
} from '@jest/utils';

describe('Auth', () => {
  const email = 'auth@test.fr';
  const cookieHeader = 'carrefour-ocpi-cookies';
  let user: User;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const res = await createUserAndGetAccessToken({ email });
    //@ts-ignore
    user = res[0];
    //@ts-ignore
    accessToken = res[1];
    //@ts-ignore
    refreshToken = res[2];
  });

  afterAll(async () => {
    await prisma.user.delete({
      where: {
        id: user.id,
      },
    });
  });

  describe('global', () => {
    it('should return UnAuthorized by default', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/this-is-a-random-url',
      });

      expect(response.statusCode).toBe(401);
      expect(JSON.parse(response.body)).toMatchObject({ error: 'Unauthorized' });
    });
  });

  describe('getUserMe', () => {
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

    it('should return an access denied if no access token', async () => {
      await testIfQueryIsProtected(testMercuriusClient, gql);
    });

    it('should return an access denied with wrong accessToken', async () => {
      await testIfAccessTokenIsInvalidQuery(testMercuriusClient, gql);
    });

    it('should return 200 with user information', async () => {
      const res = await testMercuriusClient.query(gql, {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
      });

      expect(res).toMatchObject(goodResponse);
      expect(res?.errors).toBeUndefined();
    });
  });

  describe('userRegister', () => {
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

    afterAll(async () => {
      await prisma.user.deleteMany({
        where: {
          email: goodVariables.email,
        },
      });
    });

    afterEach(() => jest.resetAllMocks());

    it('should create a new record in DB', async () => {
      jest.spyOn(global.sendim, 'sendTransactionalMail');
      const res = await testMercuriusClient.mutate(gql, {
        variables: {
          userRegister: goodVariables,
        },
      });

      const record = await prisma.user.findFirst({ where: { email: goodVariables.email } });

      expect(res).toMatchObject(goodResponse);
      expect(res?.errors).toBeUndefined();
      expect(record).not.toBeNull();
      expect(global.sendim.sendTransactionalMail).toHaveBeenCalled();
    });

    it('should not allow bad emails', async () => {
      const res = await testMercuriusClient.mutate(gql, {
        variables: {
          userRegister: { ...goodVariables, email: 'badmail' },
        },
      });

      expect(res).not.toMatchObject(goodResponse);
      expect(res.errors![0].message).toContain('Bad Request');
      expect(res.errors![0].extensions).toMatchObject({ error: AuthErrors.email_not_valid });
    });

    it('should not allow already used email', async () => {
      const res = await testMercuriusClient.mutate(gql, {
        variables: {
          userRegister: goodVariables,
        },
      });

      expect(res).not.toMatchObject(goodResponse);
      expect(res.errors![0].message).toContain('Bad Request');
      expect(res.errors![0].extensions).toMatchObject({ error: 'user_already_exist' });
    });

    it('should fullfil password validation', async () =>
      await testPasswordValidation(
        testMercuriusClient,
        gql,
        { userRegister: { ...goodVariables, email: 'goodmailpassword@mail.com' } },
        'userRegister.password',
      ));
  });

  describe('login', () => {
    const goodPayload = {
      email,
      password: DEFAULT_PASSWORD,
    };

    it('should login user', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: goodPayload,
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('access_token');
    });

    it('should not allow inexisting account', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { ...goodPayload, email: 'unknown@mail.com' },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).not.toBe(200);
      expect(body).not.toHaveProperty('access_token');
      expect(body.error).toContain('Bad Request');
      expect(body.context).toMatchObject({
        error: 'account_not_found',
      });
    });

    it('should not allow wrong password', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { ...goodPayload, password: 'bad' },
      });

      const body = JSON.parse(response.body);

      expect(response.statusCode).not.toBe(200);
      expect(body).not.toHaveProperty('access_token');
      expect(body.error).toContain('Bad Request');
      expect(body.context).toMatchObject({
        error: 'account_not_found',
      });
    });
  });

  describe('refresh', () => {
    it('should be able to generate access token', async () => {
      const cookies = testServer.encodeSecureSession(
        testServer.createSecureSession({
          refresh: refreshToken,
        }),
      );

      const response = await testServer.inject({
        url: '/auth/refresh',
        method: 'POST',
        cookies: {
          [cookieHeader]: cookies,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(JSON.parse(response.body)).toHaveProperty('access_token');
    });

    it('should return a 400 if no refresh', async () => {
      const response = await testServer.inject({
        url: '/auth/refresh',
        method: 'POST',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('logout', () => {
    let token;
    beforeEach(async () => {
      const res = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: DEFAULT_PASSWORD },
      });

      token = JSON.parse(res.body).access_token;
    });

    it('should logout user', async () => {
      const cookies = testServer.encodeSecureSession(
        testServer.createSecureSession({
          refresh: refreshToken,
        }),
      );
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer ${token}`,
        },
        cookies: {
          [cookieHeader]: cookies,
        },
      });

      const record = await prisma.token.findFirst({ where: { accessToken: token } });

      expect(response.statusCode).toBe(200);
      expect(record).toBeNull();

      //@ts-ignore
      const session = testServer.decodeSecureSession(response.cookies.find((v) => v.name === cookieHeader)!.value);

      expect(session!.get('refresh')).not.toBeDefined();
    });

    it('requires a bearer token', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      const record = await prisma.token.findFirst({ where: { owner: { email } } });

      expect(response.statusCode).not.toBe(200);
      expect(record).not.toBeNull();
    });

    it('requires a valid bearer token', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer aBadToken`,
        },
      });

      const record = await prisma.token.findFirst({ where: { owner: { email } } });

      expect(response.statusCode).not.toBe(200);
      expect(record).not.toBeNull();
    });
  });

  describe('changePassword', () => {
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
      await prisma.user.updateMany({
        where: { email },
        data: { password: await CryptoUtils.getArgonHash(DEFAULT_PASSWORD) },
      });
    });

    it('should return an access denied if no access token', async () => {
      await testIfMutationIsProtected(testMercuriusClient, gql, goodVariables);
    });

    it('should return an access denied with wrong accessToken', async () => {
      await testIfAccessTokenIsInvalidMutation(testMercuriusClient, gql, goodVariables);
    });

    it("should change user's password", async () => {
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

      expect(res).toMatchObject(goodResponse);
      expect(res?.errors).toBeUndefined();
      expect(beforePassword).not.toEqual(afterPassword);
    });

    it('should not allow a wrong password', async () => {
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

      expect(res).not.toMatchObject(goodResponse);
      expect(res.errors![0].message).toContain('Bad Request');
      expect(res.errors![0].extensions).toMatchObject({ error: 'password_error' });
      expect(beforePassword).toEqual(afterPassword);
    });
  });

  describe('askResetPassword', () => {
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
      await prisma.user.updateMany({
        where: { email },
        data: { resetPasswordCode: null },
      });

      jest.clearAllMocks();
    });

    it('create a reset code', async () => {
      jest.spyOn(global.sendim, 'sendTransactionalMail');
      const res = await testMercuriusClient.mutate(gql, {
        ...goodVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const record = await prisma.user.findFirst({ where: { email } });

      expect(res).toMatchObject(goodResponse);
      expect(res?.errors).toBeUndefined();
      expect(record?.resetPasswordCode).not.toBeNull();
      expect(global.sendim.sendTransactionalMail).toHaveBeenCalled();
    });

    it('should not allow an unknown account', async () => {
      const badVariables = set(goodVariables, 'variables.email', 'unknown@test.com');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const record = await prisma.user.findFirst({ where: { email } });

      expect(res).not.toMatchObject(goodResponse);
      expect(res?.errors).not.toBeUndefined();
      expect(res.errors![0].message).toContain('Bad Request');
      expect(res.errors![0].extensions).toMatchObject({ error: 'account_not_found' });
      expect(record?.resetPasswordCode).toBeNull();
    });
  });

  describe('resetPassword', () => {
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

      await prisma.user.updateMany({
        where: { email },
        data: { resetPasswordCode: resetCode },
      });
    });

    afterEach(async () => {
      await prisma.user.updateMany({
        where: { email },
        data: { resetPasswordCode: null, password: await CryptoUtils.getArgonHash(DEFAULT_PASSWORD) },
      });
    });

    it('should reset the password', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });

      const res = await testMercuriusClient.mutate(gql, {
        ...goodVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });

      expect(res).toMatchObject(goodResponse);
      expect(res?.errors).toBeUndefined();
      expect(afterMutationUser?.resetPasswordCode).toBeNull();
      expect(afterMutationUser?.password).not.toEqual(beforeMutationUser?.password);
    });

    it('should not allow a wrong reset code', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });

      const badVariables = set(goodVariables, 'variables.resetCode', '4321');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });

      expect(res).not.toMatchObject(goodResponse);
      expect(res?.errors).not.toBeUndefined();
      expect(res.errors![0].message).toContain('Bad Request');
      expect(res.errors![0].extensions).toMatchObject({ error: 'wrong_reset_code' });
      expect(afterMutationUser?.resetPasswordCode).not.toBeNull();
      expect(afterMutationUser?.password).toEqual(beforeMutationUser?.password);
    });

    it('should not allow a wrong reset code', async () => {
      const beforeMutationUser = await prisma.user.findFirst({ where: { email } });

      const badVariables = set(goodVariables, 'variables.email', 'unknown@test.fr');
      const res = await testMercuriusClient.mutate(gql, {
        ...badVariables,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      const afterMutationUser = await prisma.user.findFirst({ where: { email } });

      expect(res).not.toMatchObject(goodResponse);
      expect(res?.errors).not.toBeUndefined();
      expect(res.errors![0].message).toContain('Bad Request');
      expect(res.errors![0].extensions).toMatchObject({ error: 'account_not_found' });
      expect(afterMutationUser?.resetPasswordCode).not.toBeNull();
      expect(afterMutationUser?.password).toEqual(beforeMutationUser?.password);
    });
  });
});
