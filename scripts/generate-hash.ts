/* eslint-disable no-console */
import crypto from 'node:crypto';
import Prompt from 'prompt-sync';
const prompt = Prompt();

import 'dotenv/config';

import { decoders, encoders } from '@47ng/codec';

function hashString(input: string, config) {
  const decode = decoders[config.inputEncoding || 'utf8'];
  const encode = encoders[config.outputEncoding || 'hex'];
  const data = decode(input);
  const hash = crypto.createHash(config.algorithm || 'sha256');
  hash.update(data);
  if (config.salt) {
    hash.update(decode(config.salt));
  }
  return encode(hash.digest());
}

(async () => {
  console.log('=======================');
  console.log('Generate Email hash for user');
  console.log('=======================');

  let email;

  while (!email || email?.length === 0) {
    email = prompt('Email = ');
  }

  const saltKey = prompt(
    `PRISMA_FIELD_ENCRYPTION_HASH_SALT (${process.env.PRISMA_FIELD_ENCRYPTION_HASH_SALT}) =`,
    process.env.PRISMA_FIELD_ENCRYPTION_HASH_SALT,
  );

  console.log('=======================');
  console.log('Result :');
  console.log(hashString(email, { salt: saltKey }));
})();
