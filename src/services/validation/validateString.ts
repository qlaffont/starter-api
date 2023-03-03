import { Type } from '@sinclair/typebox';
import { BadRequest } from 'unify-errors';
import addFormats from 'ajv-formats';
import Ajv from 'ajv';
import { AuthErrors } from '../../components/auth/authType';

const ajv = addFormats(new Ajv({}), [
  'date-time',
  'time',
  'date',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uri',
  'uri-reference',
  'uuid',
  'uri-template',
  'json-pointer',
  'relative-json-pointer',
  'regex',
]);

export const validatePassword = (password: string) => {
  if (!password) {
    throw new BadRequest({ error: AuthErrors.password_validation_error });
  }

  if (password?.length < 8) {
    throw new BadRequest({ error: AuthErrors.password_validation_error });
  }

  if (password?.length > 20) {
    throw new BadRequest({ error: AuthErrors.password_validation_error });
  }
};

export const validateEmail = (email: string) => {
  const schema = ajv.compile(Type.String({ format: 'email' }));

  if (!schema(email)) {
    throw new BadRequest({ error: AuthErrors.email_not_valid });
  }
};
