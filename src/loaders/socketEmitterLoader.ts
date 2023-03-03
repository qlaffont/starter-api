import { Emitter } from '@socket.io/postgres-emitter';
import { Pool } from 'pg';

export const loadEmitter = async () => {
  if (!global.socketEmitter) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL as string,
    });
    global.socketEmitter = new Emitter(pool);
    await global.socketEmitter.connect();
  }

  return new Emitter(global.socketEmitter);
};
