import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PatientNotFoundError } from '@src/errors/patientNotFound';
import { PrismaService } from '@src/prisma/prisma.service';

// helper para normalizar código de acesso
function normalizeCode(s: string) {
  return s.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

// helper para calcular idade a partir de birthDate
function calcAge(birthDate?: Date | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - birthDate.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

@Injectable()
export class PatientService {
  constructor(private prisma: PrismaService, private jwt: JwtService) { }

  async loginByCode(codeRaw: string) {
    const code = normalizeCode(codeRaw);
    const digest = crypto
      .createHmac('sha256', process.env.CODE_SECRET || 'dev')
      .update(code)
      .digest('hex');

    const accessCode = await this.prisma.accessCode.findUnique({
      where: { codeDigest: digest },
      include: { patient: true },
    });

    if (!accessCode) {
      throw new NotFoundException('Código inválido ou expirado');
    }

    const now = new Date();
    if (
      accessCode.usedAt ||
      accessCode.expiresAt <= now ||
      accessCode.revokedAt
    ) {
      await this.prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: now },
      });
      throw new NotFoundException('Código inválido ou expirado');
    }

    // segurança extra: checa hash
    const ok = await bcrypt.compare(code, accessCode.codeHash);
    if (!ok) {
      await this.prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });
      throw new NotFoundException('Código inválido');
    }

    // marca uso
    await this.prisma.accessCode.update({
      where: { id: accessCode.id },
      data: { uses: { increment: 1 }, },
      //atualizar hasAccount para true
    });

    //atualizar hasAccount para true
    await this.prisma.user.update({
      where: { id: accessCode.patientId },
      data: { hasAccount: true },
    });

    // gera JWT pro paciente
    const token = this.jwt.sign(
      { sub: accessCode.patientId, role: 'PATIENT' },
      {
        secret: process.env.JWT_SECRET || 'segredo123',
        expiresIn: '30d',
      },
    );

    return {
      accessToken: token,
      patient: {
        id: accessCode.patient.id,
        name: accessCode.patient.name,
        birthDate: accessCode.patient.birthDate,
        gender: accessCode.patient.gender,
        age: calcAge(accessCode.patient.birthDate),
      },
      accessCode: {
        id: accessCode.id,
        createdAt: accessCode.createdAt,
        expiresAt: accessCode.expiresAt,
        uses: accessCode.uses + 1,
        attempts: accessCode.attempts,
      },
      user: {
        id: accessCode.patient.id,
        name: accessCode.patient.name,
        birthDate: accessCode.patient.birthDate,
        gender: accessCode.patient.gender,
        age: calcAge(accessCode.patient.birthDate)
      },
    };
  }

  async getProfilePatient(patientId: string) {
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        birthDate: true,
        gender: true,
        createdAt: true,
        contacts: true,
        fallAlerts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!patient) {
      throw new PatientNotFoundError(patientId);
    }

    return {
      ...patient,
      age: calcAge(patient.birthDate),
    };
  }

}
