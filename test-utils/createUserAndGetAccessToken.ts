import { User } from '@prisma/client';
import { loadPrismaClient } from '../src/services/prisma/loadClient';
import { userFactory } from '../prisma/factories/user.factory';
import AuthController from '../src/components/auth/authController';

const prisma = loadPrismaClient();

export const DEFAULT_PASSWORD = 'password';

export const createUserAndGetAccessToken = async (userData?: Partial<User>) => {
  const user = await prisma.user.create({
    data: await userFactory({ ...userData, password: DEFAULT_PASSWORD }),
  });

  const res = await AuthController.loginAndGenerateToken(user, {
    //@ts-ignore
    session: {
      //@ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      set: () => {},
    },
  });

  const refreshToken = (await prisma.token.findFirst({
    where: {
      accessToken: res.access_token,
    },
  }))!.refreshToken;

  return [user, res.access_token, refreshToken];
};
