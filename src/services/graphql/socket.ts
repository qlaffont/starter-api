import { Emitter } from '@socket.io/redis-emitter';
import { createParamDecorator } from 'type-graphql';

export function Socket() {
  return createParamDecorator<{ socket: Emitter }>(({ context }) => context.socket);
}
