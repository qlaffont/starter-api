/* eslint-disable @typescript-eslint/no-var-requires */
import fastifyPassport from '@fastify/passport';
import { Strategy as DiscordStrategy } from '@oauth-everything/passport-discord';
import { User } from '../../../prisma/client';

export const loadPassport = (fastify: FastifyCustomInstance) => {
  fastify.register(fastifyPassport.initialize());
  fastify.register(fastifyPassport.secureSession());
  fastifyPassport.use(
    'discord',
    new DiscordStrategy(
      {
        clientID: process.env.DISCORD_OAUTH_CLIENT_ID as string,
        clientSecret: process.env.DISCORD_OAUTH_CLIENT_SECRET as string,
        callbackURL: `${process.env.API_URL}/auth/authorization`,
        scope: ['identify', 'email'],
      },
      async function (accessToken, refreshToken, profile, cb) {
        const user: User = await prisma.user.upsert({
          where: { discordUserId: profile.id },
          create: {
            discordUserId: profile.id,
            username: profile.username,
            email: profile.emails[0].value,
            avatarUrl: profile.photos[0].value,
          },
          update: {
            discordUserId: profile.id,
            email: profile.emails[0].value,
            avatarUrl: profile.photos[0].value,
          },
        });

        return cb(null, user);
      },
    ),
  );

  fastifyPassport.registerUserSerializer(async (user: any) => user.id);
  fastifyPassport.registerUserDeserializer(async (id: string) => {
    return await prisma.user.findFirst({ where: { id } });
  });
};
