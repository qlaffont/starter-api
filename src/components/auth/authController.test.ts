import 'reflect-metadata';
import { notEqual } from 'assert';
import { User } from '@prisma/client';
import { before, after } from '@tapjs/mocha-globals';
import { equal, match, test, beforeEach } from 'tap';
import { createUserAndGetAccessToken, DEFAULT_PASSWORD, setupTests } from '@test/utils';

before(setupTests);

test('Auth', async () => {
  const email = 'auth-controller@test.fr';
  const cookieHeader = 'myapp-cookies';
  let user: User;
  let refreshToken: string;

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

  test('global', async () => {
    test('should return UnAuthorized by default', async () => {
      const response = await testServer.inject({
        method: 'GET',
        url: '/this-is-a-random-url',
      });

      equal(response.statusCode, 401);
      match(JSON.parse(response.body), { error: 'Unauthorized' });
    });
  });

  test('login', async () => {
    const goodPayload = {
      email,
      password: DEFAULT_PASSWORD,
    };

    test('should login user', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: goodPayload,
      });

      equal(response.statusCode, 200);
      match(Object.keys(JSON.parse(response.body)), ['access_token']);
    });

    test('should not allow inexisting account', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { ...goodPayload, email: 'unknown@mail.com' },
      });

      const body = JSON.parse(response.body);

      notEqual(response.statusCode, 200);
      notEqual(Object.keys(JSON.parse(response.body)), ['access_token']);
      match(body.error, 'Bad Request');
      match(body.context, {
        error: 'account_not_found',
      });
    });

    test('should not allow wrong password', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { ...goodPayload, password: 'bad' },
      });

      const body = JSON.parse(response.body);

      notEqual(response.statusCode, 200);
      notEqual(Object.keys(JSON.parse(response.body)), ['access_token']);
      match(body.error, 'Bad Request');
      match(body.context, {
        error: 'account_not_found',
      });
    });
  });

  //TODO: TO FIX
  // test('refresh', async () => {
  //   test('should be able to generate access token', async () => {
  //     const cookies = testServer.encodeSecureSession(
  //       testServer.createSecureSession({
  //         refresh: refreshToken,
  //       }),
  //     );

  //     const response = await testServer.inject({
  //       url: '/auth/refresh',
  //       method: 'POST',
  //       cookies: {
  //         [cookieHeader]: cookies,
  //       },
  //     });

  //     console.log(response);

  //     equal(response.statusCode, 200);
  //     match(Object.keys(JSON.parse(response.body)), ['access_token']);
  //   });

  //   test('should return a 400 if no refresh', async () => {
  //     const response = await testServer.inject({
  //       url: '/auth/refresh',
  //       method: 'POST',
  //     });

  //     equal(response.statusCode, 400);
  //   });
  // });

  test('logout', async () => {
    let token;
    beforeEach(async () => {
      const res = await testServer.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email, password: DEFAULT_PASSWORD },
      });

      token = JSON.parse(res.body).access_token;
    });

    test('should logout user', async () => {
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

      equal(response.statusCode, 200);
      equal(record, null);

      //@ts-ignore
      const session = testServer.decodeSecureSession(response.cookies.find((v) => v.name === cookieHeader)!.value);

      equal(session!.get('refresh'), undefined);
    });

    test('requires a bearer token', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/logout',
      });

      const record = await prisma.token.findFirst({ where: { owner: { email } } });

      notEqual(response.statusCode, 200);
      notEqual(record, null);
    });

    test('requires a valid bearer token', async () => {
      const response = await testServer.inject({
        method: 'POST',
        url: '/auth/logout',
        headers: {
          authorization: `Bearer aBadToken`,
        },
      });

      const record = await prisma.token.findFirst({ where: { owner: { email } } });

      notEqual(response.statusCode, 200);
      notEqual(record, null);
    });
  });
});
