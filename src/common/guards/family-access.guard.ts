import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FamilyService } from '../../family/family.service';

// Decorator para marcar endpoints que precisam de permissão específica
export const RequirePermission = Reflector.createDecorator<string>();

@Injectable()
export class FamilyAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private familyService: FamilyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const patientId = request.params.patientId || request.body.patientId;
    
    if (!user || !patientId) {
      throw new ForbiddenException('Usuário ou paciente não identificado');
    }

    // Se é CAREGIVER principal, sempre tem acesso total
    if (user.role === 'CAREGIVER') {
      const hasAccess = await this.familyService.hasAccessToPatient(user.userId, patientId);
      if (!hasAccess) {
        throw new ForbiddenException('Você não tem acesso a este paciente');
      }
      return true;
    }

    // Se é PATIENT, só pode acessar próprios dados
    if (user.role === 'PATIENT') {
      if (user.userId !== patientId) {
        throw new ForbiddenException('Você só pode acessar seus próprios dados');
      }
      return true;
    }

    // Se é FAMILY_MEMBER, verificar permissões específicas
    if (user.role === 'FAMILY_MEMBER') {
      const hasAccess = await this.familyService.hasAccessToPatient(user.userId, patientId);
      if (!hasAccess) {
        throw new ForbiddenException('Você não tem acesso a este paciente');
      }

      // Verificar permissão específica se definida
      const requiredPermission = this.reflector.get(RequirePermission, context.getHandler());
      
      if (requiredPermission) {
        const permissions = await this.familyService.getFamilyPermissions(user.userId, patientId);
        
        if (!permissions) {
          throw new ForbiddenException('Permissões não encontradas');
        }

        const hasPermission = permissions[requiredPermission];
        if (!hasPermission) {
          throw new ForbiddenException(`Você não tem permissão para: ${requiredPermission}`);
        }
      }

      return true;
    }

    throw new ForbiddenException('Tipo de usuário não autorizado');
  }
}