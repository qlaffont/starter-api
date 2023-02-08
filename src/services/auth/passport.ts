/* eslint-disable @typescript-eslint/no-var-requires */
import fastifyPassport from '@fastify/passport';

export const loadPassport = (fastify: FastifyCustomInstance) => {
  fastify.register(fastifyPassport.initialize());
  fastify.register(fastifyPassport.secureSession());

  fastifyPassport.registerUserSerializer(async (user: any) => user.id);
  fastifyPassport.registerUserDeserializer(async (id: string) => {
    return await prisma.user.findFirst({ where: { id } });
  });
};
