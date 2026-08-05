import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedCustomer } from '../users.types';

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthenticatedCustomer => {
  return ctx.switchToHttp().getRequest().user;
});
