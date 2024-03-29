import { subDays } from 'date-fns';
import { AuthActions, createQueueMQ, createWorkerMQ, QUEUE } from './../../services/bull/Bull';

export const handleAuthQueue = () => {
  logger.info('[QUEUE] Auth Queue Loaded');

  const authQueue = createQueueMQ(QUEUE.AUTH);

  authQueue.add(AuthActions.CLEAN_EXPIRED_TOKENS, undefined, { repeat: { pattern: '0 3 * * *' } });
  authQueue.add(AuthActions.CLEAN_EXPIRED_TOKENS, undefined);

  const worker = createWorkerMQ<
    {
      path: string;
    },
    void,
    AuthActions
  >(QUEUE.AUTH, async (job) => {
    const action = job.name;

    if (action === AuthActions.CLEAN_EXPIRED_TOKENS) {
      job.updateProgress({});
      const tokens = await prisma.token.findMany({
        where: {
          createdAt: {
            lte: subDays(new Date(), parseInt(`${env.JWT_REFRESH_TIME}`, 10) + 1),
          },
        },
      });

      await Promise.all(tokens.map((t) => prisma.token.delete({ where: { id: t.id } })));
    }
  });

  worker.on('progress', (job) => logger.debug(`[AUTH] Processing job ${job.id} (${job.name})`));
  worker.on('completed', (job) => logger.debug(`[AUTH] Completed job ${job.id} (${job.name}) successfully`));
  worker.on('failed', (job, err) => logger.debug(`[AUTH] Failed job ${job.id} (${job.name}) with ${err}`));

  return [worker];
};
