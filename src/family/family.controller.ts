import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { FamilyService } from './family.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';
import { InviteFamilyMemberDto } from './dtos/invite-family-member.dto';
import { AcceptFamilyInviteDto } from './dtos/accept-family-invite.dto';
import { UpdateFamilyPermissionsDto } from './dtos/update-family-permissions.dto';

@Controller('family')
export class FamilyController {
  constructor(private readonly familyService: FamilyService) { }

  // Cuidador principal convida familiar
  @Post('invite')
  @UseGuards(JwtAuthGuard)
  async inviteFamilyMember(
    @CurrentUserId() caregiverId: string,
    @Body() dto: InviteFamilyMemberDto,
  ) {
    return this.familyService.inviteFamilyMember(caregiverId, dto);
  }

  // Familiar aceita convite (endpoint público)
  @Post('accept-invite')
  async acceptFamilyInvite(@Body() dto: AcceptFamilyInviteDto) {
    return this.familyService.acceptFamilyInvite(dto);
  }

  // Familiar lista pacientes que tem acesso
  @Get('patients')
  @UseGuards(JwtAuthGuard)
  async getFamilyPatients(@CurrentUserId() familyMemberId: string) {
    return this.familyService.getFamilyPatients(familyMemberId);
  }

  // Cuidador principal lista familiares de um paciente
  @Get('patients/:patientId/members')
  @UseGuards(JwtAuthGuard)
  async getFamilyMembersByPatient(
    @CurrentUserId() caregiverId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.familyService.getFamilyMembersByPatient(caregiverId, patientId);
  }

  // Cuidador principal atualiza permissões de familiar
  @Put('patients/:patientId/members/:familyMemberId/permissions')
  @UseGuards(JwtAuthGuard)
  async updateFamilyPermissions(
    @CurrentUserId() caregiverId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
    @Body() dto: UpdateFamilyPermissionsDto,
  ) {
    return this.familyService.updateFamilyPermissions(
      caregiverId,
      familyMemberId,
      patientId,
      dto,
    );
  }

  // Cuidador principal revoga acesso de familiar
  @Delete('patients/:patientId/members/:familyMemberId')
  @UseGuards(JwtAuthGuard)
  async revokeFamilyAccess(
    @CurrentUserId() caregiverId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.familyService.revokeFamilyAccess(
      caregiverId,
      familyMemberId,
      patientId,
    );
  }

  // Obter informações completas da família de um paciente
  @Get('patients/:patientId/full-family')
  @UseGuards(JwtAuthGuard)
  async getFullFamilyInfo(
    @CurrentUserId() userId: string,
    @Param('patientId') patientId: string,
  ) {
    return this.familyService.getFullFamilyInfo(patientId, userId);
  }

  @Delete('patients/:patientId/members/:familyMemberId/permanent')
  @UseGuards(JwtAuthGuard)
  async deleteFamilyMemberCompletely(
    @CurrentUserId() caregiverId: string,
    @Param('patientId') patientId: string,
    @Param('familyMemberId') familyMemberId: string,
  ) {
    return this.familyService.deleteFamilyMemberCompletely(
      caregiverId,
      familyMemberId,
      patientId,
    );
  }

}