import { FastifyReply, FastifyRequest } from 'fastify';
import { createUserToken, getAccessTokenFromRequest, refreshUserToken, removeUserToken } from 'fastify-auth-prisma';
import { BadRequest } from 'unify-errors';
import { User } from '../../../prisma/client';
import { CryptoUtils } from '../../services/crypto/crypto.utils';

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
}

export default AuthController;
