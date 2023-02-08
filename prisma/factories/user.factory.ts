import { faker } from '@faker-js/faker';
import { Prisma } from '../client/index';
import { CryptoUtils } from '../../src/services/crypto/crypto.utils';

export const userFactory = async (
  input: Partial<Prisma.UserCreateManyInput> = {},
): Promise<Prisma.UserCreateManyInput> => {
  const { firstName: inputFirstName, lastName: inputLastName, password: inputPassword, ...data } = input;
  const firstName = inputFirstName || faker.name.firstName();
  const lastName = inputLastName || faker.name.firstName();
  const password = inputPassword || faker.internet.password();

  return {
    firstName,
    lastName,
    email: faker.internet.email(firstName, lastName),
    password: await CryptoUtils.getArgonHash(password),
    ...data,
  };
};
