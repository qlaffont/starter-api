import { createParamDecorator } from 'type-graphql-v2-fork';
import { User } from '../../../prisma/type-graphql';

export function CurrentUser() {
  return createParamDecorator<{ user: User }>(({ context }) => context.user as User);
}
