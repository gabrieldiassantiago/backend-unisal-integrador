import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUserWithFamily = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Inclui patientAccess se for FAMILY_MEMBER
  },
);