import { InputType, Field } from 'type-graphql';
import { UserCreateInput } from '../../../prisma/type-graphql';

@InputType()
export class UserRegister implements Partial<UserCreateInput> {
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
