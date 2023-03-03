export const authSchema = {
  security: [
    {
      bearerAuth: [],
    },
  ],
};

export const login = {
  description: 'Login with email & password',
  tags: ['Auth'],
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

export const userInfo = {
  ...authSchema,
  description: 'User Info',
  tags: ['Auth'],
};
