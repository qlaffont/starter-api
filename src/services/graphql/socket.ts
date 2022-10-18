import { Emitter } from '@socket.io/redis-emitter';
import { createParamDecorator } from 'type-graphql-v2-fork';

export function Socket() {
  return createParamDecorator<{ socket: Emitter }>(({ context }) => context.socket);
}
