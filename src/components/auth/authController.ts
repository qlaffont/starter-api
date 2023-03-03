import { FastifyReply, FastifyRequest } from 'fastify';
import { createUserToken, getAccessTokenFromRequest, refreshUserToken, removeUserToken } from 'fastify-auth-prisma';
import { BadRequest } from 'unify-errors';
import { faker } from '@faker-js/faker';
import { User } from '@prisma/client';
import { validatePassword, validateEmail } from '../../services/validation/validateString';
import { CryptoUtils } from '../../services/crypto/crypto.utils';
import { AuthErrors, UserRegister } from './authType';
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

  static async registerUser(registerUser: UserRegister) {
    const existingUser = await prisma.user.findFirst({
      where: { email: registerUser.email },
    });

    if (existingUser) {
      throw new BadRequest({ error: AuthErrors.user_already_exist });
    }

    await validatePassword(registerUser.password);
    await validateEmail(registerUser.email);

    await sendim.sendTransactionalMail({
      to: [{ email: registerUser.email, name: `${registerUser.firstName} ${registerUser.lastName}` }],
      sender: { email: 'dev+carrefour@flexper.fr', name: 'Carrefour Energies' },
      params: {
        gotoapp_link: new URL('/', process.env.CLIENT_URL).toString(),
      },
      templateId: '2',
    });

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
      throw new BadRequest({ error: AuthErrors.account_not_found });
    }

    if (!(await CryptoUtils.compareArgonHash(password, user.password))) {
      throw new BadRequest({ error: AuthErrors.account_not_found });
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

      if (!refreshToken || refreshToken?.length < 0) {
        throw new BadRequest({ error: 'refresh_not_found' });
      }
      const { accessToken } = await refreshUserToken(prisma)(refreshToken, {
        secret: process.env.JWT_ACCESS_SECRET!,
        accessTokenTime: process.env.JWT_ACCESS_TIME!,
      });

      res.send({
        access_token: accessToken,
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
      throw new BadRequest({ error: AuthErrors.account_not_found });
    }

    if (!(await CryptoUtils.compareArgonHash(oldPassword, user.password))) {
      throw new BadRequest({ error: AuthErrors.password_error });
    }

    await validatePassword(newPassword);

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
      throw new BadRequest({ error: AuthErrors.account_not_found });
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

    await sendim.sendTransactionalMail({
      to: [{ email: user.email, name: `${user.firstName} ${user.lastName}` }],
      sender: { email: 'dev+carrefour@flexper.fr', name: 'Carrefour Energies' },
      params: {
        code: resetCode,
      },
      templateId: '6',
    });
  }

  static async resetPassword(email: string, resetPasswordCode: string, password: string) {
    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user) {
      throw new BadRequest({ error: AuthErrors.account_not_found });
    }

    if (user.resetPasswordCode !== resetPasswordCode) {
      throw new BadRequest({ error: AuthErrors.wrong_reset_code });
    }

    await validatePassword(password);

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
