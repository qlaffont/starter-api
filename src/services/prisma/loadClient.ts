import { PrismaClient } from '@prisma/client';
import { fieldEncryptionExtension } from 'prisma-field-encryption';

export const loadPrismaClient = () => {
  let prisma = new PrismaClient();

  //@ts-ignore
  prisma = prisma.$extends(fieldEncryptionExtension());

  return prisma as PrismaClient;
};
