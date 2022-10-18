import { Arg, Authorized, Mutation, Query, Resolver } from 'type-graphql';
import { CurrentUser } from '../../services/graphql/user';
import { User, Language } from './auth';

@Resolver(() => User)
export class AuthResolver {
  @Authorized()
  @Query(() => User)
  async getUserMe(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Authorized()
  @Mutation(() => User)
  async updateLanguage(
    @CurrentUser() user: User,
    @Arg('language', () => Language, { description: `Value : ${Object.values(Language).join(', ')}` })
    language: string,
  ): Promise<User> {
    return prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lang: language as keyof typeof Language,
      },
    });
  }
}
