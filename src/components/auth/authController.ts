import { FastifyReply, FastifyRequest } from 'fastify';
import { createUserToken, getAccessTokenFromRequest, refreshUserToken, removeUserToken } from 'fastify-auth-prisma';
import { BadRequest } from 'unify-errors';
import { faker } from '@faker-js/faker';
import { User } from '../../../prisma/client';
import { CryptoUtils } from '../../services/crypto/crypto.utils';
import { UserRegister } from './authType';

class AuthController {
  static async loginAndGenerateToken(user: User, req: FastifyRequest) {
    const { accessToken, refreshToken } = await createUserToken(prisma)(user.id, {
      secret: process.env.JWT_ACCESS_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      accessTokenTime: process.env.JWT_ACCESS_TIME!,
      refreshTokenTime: process.env.JWT_REFRESH_TIME!,
    });

    req.session.set('refresh', refreshToken);

    return { access_token: accessToken };
  }

  static async validatePassword(password: string) {
    if (!password) {
      throw new BadRequest({ error: 'password_validation_failed' });
    }

    if (password?.length < 8) {
      throw new BadRequest({ error: 'password_validation_failed' });
    }

    if (password?.length > 20) {
      throw new BadRequest({ error: 'password_validation_failed' });
    }
  }

  static async registerUser(registerUser: UserRegister) {
    const existingUser = await prisma.user.findFirst({
      where: { email: registerUser.email },
    });

    if (existingUser) {
      throw new BadRequest({ error: 'user_already_exist' });
    }

    await this.validatePassword(registerUser.password);

    return prisma.user.create({
      data: {
        ...registerUser,
        password: await CryptoUtils.getArgonHash(registerUser.password),
      },
    });
  }

  static async login({ email, password }: { email: string; password: string }, req: FastifyRequest) {
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new BadRequest({ error: 'account_not_found' });
    }

    if (!(await CryptoUtils.compareArgonHash(password, user.password))) {
      throw new BadRequest({ error: 'invalid_password' });
    }

    return AuthController.loginAndGenerateToken(user, req);
  }

  static async logout(req: FastifyRequest, res: FastifyReply) {
    const accessToken = getAccessTokenFromRequest(req);

    await removeUserToken(prisma)(accessToken!);

    req.session.set('refresh', undefined);

    res.send();
  }

  static async refresh(req: FastifyRequest, res: FastifyReply) {
    try {
      const refreshToken = req.session.get('refresh');

      const { accessToken } = await refreshUserToken(prisma)(refreshToken, {
        secret: process.env.JWT_ACCESS_SECRET!,
        accessTokenTime: process.env.JWT_ACCESS_TIME!,
      });

      res.send({
        accessToken,
      });
    } catch (error) {
      req.session.set('refresh', undefined);
      throw new BadRequest();
    }
  }

  static async getUserInfo(req: FastifyRequest, res: FastifyReply) {
    const { id, email, firstName, lastName } = req.connectedUser!;

    res.send({ id, email, firstName, lastName });
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequest({ error: 'account_not_found' });
    }

    if (!(await CryptoUtils.compareArgonHash(oldPassword, user.password))) {
      throw new BadRequest({ error: 'invalid_password' });
    }

    await this.validatePassword(newPassword);

    return prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        password: await CryptoUtils.getArgonHash(newPassword),
      },
    });
  }

  static async askResetPassword(email: string) {
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new BadRequest({ error: 'account_not_found' });
    }

    const resetCode = faker.random.numeric(4);
    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetPasswordCode: resetCode,
      },
    });

    //TODO send email
    logger.info(`[TO REMOVE] Reset Passord code ${JSON.stringify({ email, resetCode })}`);
  }

  static async resetPassword(email: string, resetPasswordCode: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { email, resetPasswordCode },
    });

    if (!user) {
      throw new BadRequest({ error: 'account_not_found' });
    }

    await this.validatePassword(password);

    await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        resetPasswordCode: null,
        password: await CryptoUtils.getArgonHash(password),
      },
    });
  }
}

export default AuthController;
