import { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common/decorators/http/create-route-param-metadata.decorator';
import { User } from '../entities/user.entity';

export const GetUser = createParamDecorator((data, ctx: ExecutionContext): User => {
  const req = ctx.switchToHttp().getRequest();
  return req.user;
});
