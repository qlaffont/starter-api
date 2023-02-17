import pino from 'pino';
import 'dotenv/config';
import { fieldEncryptionMiddleware } from 'prisma-field-encryption';
import { PrismaClient } from '@prisma/client';
import { userFactory } from './factories/user.factory';

const logger = pino({ level: process.env.LOG || 'info' });

const prisma = new PrismaClient();

prisma.$use(fieldEncryptionMiddleware());

async function main() {
  // ! CONFIGURATION
  const nbOfUsers = 3;

  // 1 - Create Users
  for (let index = 0; index < nbOfUsers; index++) {
    let userData;

    if (index === 0) {
      userData = await userFactory({
        email: 'test@test.fr',
        password: 'password',
      });
    } else {
      userData = await userFactory({
        password: 'password',
      });
    }

    await prisma.user.create({
      data: userData,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    logger.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
