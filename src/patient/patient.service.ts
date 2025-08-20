import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';

function normalizeCode(s: string) {
  return s.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

@Injectable()
export class PatientService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

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
    if (accessCode.usedAt || accessCode.expiresAt <= now || accessCode.revokedAt) {
      await this.prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: now },
      });
      throw new NotFoundException('Código inválido ou expirado');
    }

    // segurança extra
    const ok = await bcrypt.compare(code, accessCode.codeHash);
    if (!ok) {
      await this.prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });
      throw new NotFoundException('Código inválido');
    }

    // marca como usado (apenas incrementa uses)
    await this.prisma.accessCode.update({
      where: { id: accessCode.id },
      data: { uses: { increment: 1 } },
    });

    // gera JWT pro paciente
    const token = this.jwt.sign(
      { sub: accessCode.patientId, role: 'PATIENT' },
      { secret: process.env.JWT_SECRET || 'segredo123', expiresIn: '30d' }
    );

    return {
      accessToken: token,
      patient: {
        id: accessCode.patient.id,
        name: accessCode.patient.name,
        age: accessCode.patient.age,
      },
    };
  }

  async getProfile(patientId: string) {
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        age: true,
        createdAt: true,
        contacts: true,
        fallAlerts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    return patient;
  }
}
