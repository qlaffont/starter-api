import { InputType, Field, registerEnumType } from 'type-graphql';
import { Prisma } from '@prisma/client';

@InputType()
export class UserRegister implements Partial<Prisma.UserCreateInput> {
  @Field(() => String, {
    nullable: false,
  })
  firstName!: string;

  @Field(() => String, {
    nullable: false,
  })
  lastName!: string;

  @Field(() => String, {
    nullable: false,
  })
  email!: string;

  @Field(() => String, {
    nullable: false,
  })
  password!: string;
}

export enum AuthErrors {
  user_already_exist = 'user_already_exist',
  account_not_found = 'account_not_found',
  password_validation_error = 'password_validation_error',
  password_error = 'password_error',
  wrong_reset_code = 'wrong_reset_code',
  email_not_valid = 'email_not_valid',
}

registerEnumType(AuthErrors, {
  name: 'AuthErrors',
});
