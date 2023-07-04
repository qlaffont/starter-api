/* eslint-disable @typescript-eslint/no-var-requires */
/** @type {import('ts-jest').JestConfigWithTsJest} */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageReporters: ['lcov'],
  testTimeout: 30000,
  moduleNameMapper: {
    '@prisma/type-graphql': '<rootDir>/prisma/type-graphql/index.ts',
    '@prisma/factories': '<rootDir>/prisma/factories/index.ts',
    '@jest/utils': '<rootDir>/jest/index.ts',
  },
  setupFiles: ['<rootDir>/jest/setup.ts'],
  coveragePathIgnorePatterns: ['node_modules', '.mock.ts', 'prisma'],
};
