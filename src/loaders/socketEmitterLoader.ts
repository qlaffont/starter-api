import { Emitter } from '@socket.io/postgres-emitter';
import * as pg from 'pg';
const { Pool } = pg;

export const loadEmitter = async () => {
  if (!global.socketEmitter) {
    const pool = new Pool({
      connectionString: env.DATABASE_URL as string,
    });
    global.socketEmitter = new Emitter(pool);
    await global.socketEmitter.connect();
  }

  return new Emitter(global.socketEmitter);
};
