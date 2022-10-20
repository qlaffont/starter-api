import { FastifyReply, FastifyRequest } from 'fastify';
import { createUserToken, getAccessTokenFromRequest, refreshUserToken, removeUserToken } from 'fastify-auth-prisma';
import { BadRequest, Forbidden } from 'unify-errors';
import { User } from '../../../prisma/client';

class AuthController {
  static async authorization(req: FastifyRequest, res: FastifyReply) {
    const user = req.user! as User;

    const { accessToken, refreshToken } = await createUserToken(prisma)(user.id, {
      secret: process.env.JWT_ACCESS_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      accessTokenTime: process.env.JWT_ACCESS_TIME!,
      refreshTokenTime: process.env.JWT_REFRESH_TIME!,
    });

    req.session.set('refresh', refreshToken);

    const urlToRedirect = new URL('/auth', process.env.CLIENT_URL);
    urlToRedirect.searchParams.append('accessToken', accessToken);

    res.redirect(urlToRedirect.toString());
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
    const { id, avatarUrl, username, email, isBanned, isActive, isAlwaysActive, isExaltyActive } = req.connectedUser!;

    if (isBanned || (!isActive && !isAlwaysActive && !isExaltyActive)) {
      throw new Forbidden();
    }

    res.send({ id, avatarUrl, username, email });
  }
}

export default AuthController;
