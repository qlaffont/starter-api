import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import { createQueueMQ, QUEUE } from './Bull';

export const loadBullDebugger = async (fastify) => {
  const serverAdapter = new FastifyAdapter();
  const Queues: any[] = [];

  for (const queue of Object.values(QUEUE)) {
    Queues.push(new BullMQAdapter(createQueueMQ(queue)));
  }

  createBullBoard({
    queues: Queues,
    serverAdapter,
  });

  serverAdapter.setBasePath('/bull');
  fastify.register(serverAdapter.registerPlugin(), { prefix: '/bull' });
};
