import { Field, ObjectType, registerEnumType } from 'type-graphql-v2-fork';

export enum Language {
  EN = 'EN',
  FR = 'FR',
}
registerEnumType(Language, {
  name: 'Language',
  description: undefined,
});

@ObjectType()
export class User {
  @Field(() => String, {
    nullable: false,
  })
  id!: string;

  @Field(() => String, {
    nullable: true,
  })
  avatarUrl?: string | null;

  @Field(() => String, {
    nullable: true,
  })
  username?: string | null;

  @Field(() => String, {
    nullable: true,
  })
  email?: string | null;

  @Field(() => Language, {
    nullable: false,
  })
  lang!: 'EN' | 'FR';

  @Field(() => String, {
    nullable: true,
  })
  twitchUsername?: string | null;
}
