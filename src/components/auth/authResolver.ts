import { Authorized, Query, Resolver } from 'type-graphql';
import { CurrentUser } from '../../services/graphql/user';
import { User } from '../../../prisma/type-graphql/models';

@Resolver(() => User)
export class AuthResolver {
  @Authorized()
  @Query(() => User)
  async getUserMe(@CurrentUser() user: User): Promise<User> {
    return user;
  }
}
