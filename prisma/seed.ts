import pino from 'pino';
import { env } from '../src/services/env';
import { loadPrismaClient } from '../src/services/prisma/loadClient';
import { userFactory } from './factories/user.factory';

const logger = pino({ level: env.LOG || 'info' });

const prisma = loadPrismaClient();

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
