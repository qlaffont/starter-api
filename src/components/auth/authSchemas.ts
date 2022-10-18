import { Type } from '@sinclair/typebox';

export const authSchema = {
  security: [
    {
      bearerAuth: [],
    },
  ],
};

export const connectToDiscord = {
  description: 'Login to Discord',
  tags: ['Auth'],
};

export const authorizeDiscordConnection = {
  description: 'OAuth Callback Discord',
  tags: ['Auth'],
  querystring: Type.Object({
    code: Type.String(),
  }),
};

export const refreshToken = {
  description: 'Refresh Token - Refresh token in session required',
  tags: ['Auth'],
};

export const logout = {
  ...authSchema,
  description: 'Signout',
  tags: ['Auth'],
};
