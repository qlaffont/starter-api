import { Emitter } from '@socket.io/redis-emitter';
import { createClient } from 'redis';

export const loadRedisEmitter = async () => {
  if (!global.redisSocketEmitter) {
    global.redisSocketEmitter = createClient({ url: process.env.REDIS_URL });
    await global.redisSocketEmitter.connect();
  }

  return new Emitter(global.redisSocketEmitter);
};
