import { Field, ObjectType } from 'type-graphql';
import { AuthErrors } from '../components/auth/authType';

@ObjectType()
export class GQLEnumErrors {
  @Field(() => AuthErrors)
  authErrors: AuthErrors;
}
