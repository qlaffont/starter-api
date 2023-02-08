import { Arg, Authorized, Mutation, Query, Resolver } from 'type-graphql';
import { User } from '../../../prisma/type-graphql/models';
import { CurrentUser } from '../../services/graphql/user';
import AuthController from './authController';
import { UserRegister } from './authType';

@Resolver(() => User)
export class AuthResolver {
  @Authorized()
  @Query(() => User)
  async getUserMe(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Mutation(() => String)
  async registerUser(@Arg('userRegister', () => UserRegister) userRegister: UserRegister): Promise<string> {
    await AuthController.registerUser(userRegister);

    return 'OK';
  }

  @Authorized()
  @Mutation(() => String)
  async changePassword(
    @CurrentUser() user: User,
    @Arg('oldPassword', () => String)
    oldPassword: string,
    @Arg('newPassword', () => String)
    newPassword: string,
  ): Promise<string> {
    await AuthController.changePassword(user.id, oldPassword, newPassword);

    return 'OK';
  }

  @Mutation(() => String)
  async askResetPassword(@Arg('email', () => String) email: string): Promise<string> {
    await AuthController.askResetPassword(email);

    return 'OK';
  }

  @Mutation(() => String)
  async resetPassword(
    @Arg('email', () => String) email: string,
    @Arg('resetCode', () => String) resetCode: string,
    @Arg('password', () => String) password: string,
  ): Promise<string> {
    await AuthController.resetPassword(email, resetCode, password);

    return 'OK';
  }
}
