import { Emitter } from '@socket.io/postgres-emitter';
import { createParamDecorator } from 'type-graphql';

export function Socket() {
  return createParamDecorator<{ socket: Emitter }>(({ context }) => context.socket);
}
