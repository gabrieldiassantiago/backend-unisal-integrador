import {
  ForbiddenException,
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

function norm(code: string) {
  return code.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function genNumeric(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += Math.floor(Math.random() * 10);
  return s;
}

const display = (c: string) =>
  c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;

function clampTtl(ttlMinutes?: number): number {
  const ttlRaw = ttlMinutes ?? Number(process.env.ACCESS_CODE_TTL_MINUTES || 30);
  return Math.min(Math.max(ttlRaw, 1), 24 * 60); // 1 min .. 24h
}

@Injectable()
export class CaregiverService {
  constructor(private prisma: PrismaService) {}

  /**
   * Cria paciente (sem conta/senha), vincula ao cuidador, cria contato e retorna código de login do paciente.
   */
  
  async createPatientAndCode(
    caregiverId: string,
    name: string,
    age?: number,
    ttlMinutes?: number,
    emergencyContactPhone?: string,
    emergencyContactName?: string,
  ) {
    const cg = await this.prisma.user.findUnique({ where: { id: caregiverId } });
    if (!cg || cg.role !== 'CAREGIVER') {
      throw new ForbiddenException('Apenas cuidadores');
    }
    if (!emergencyContactPhone) {
      throw new BadRequestException('Telefone do contato de emergência é obrigatório');
    }

    const ttl = clampTtl(ttlMinutes);
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1) Paciente sem conta/senha
      const patient = await tx.user.create({
        data: {
          name,
          age: age ?? null,
          email: null,
          password: null,
          role: 'PATIENT',
          hasAccount: false,
        },
        select: { id: true, name: true, age: true, createdAt: true },
      });

      // 2) Vínculo cuidador ↔ paciente
      await tx.caregiverPatient.create({
        data: { caregiverId, patientId: patient.id },
      });

      // 3) Contato de emergência
      try {
        await tx.emergencyContact.create({
          data: {
            name: (emergencyContactName?.trim() || cg.name || 'Contato'),
            phone: emergencyContactPhone,
            patientId: patient.id,
            priority: 1,
          },
        });
      } catch (e: any) {
        // Se phone é @unique no schema:
        if (e?.code === 'P2002' && Array.isArray(e?.meta?.target) && e.meta.target.includes('phone')) {
          throw new BadRequestException('Telefone de contato já está em uso.');
        }
        throw e;
      }

      // 4) Código de login do paciente (one-shot)
      const raw = norm(genNumeric(6));
      const codeDigest = crypto
        .createHmac('sha256', process.env.CODE_SECRET || 'dev')
        .update(raw)
        .digest('hex');
      const codeHash = await bcrypt.hash(raw, 10);

      const ac = await tx.accessCode.create({
        data: {
          codeDigest,
          codeHash,
          codeDisplay: display(raw),
          caregiverId,
          patientId: patient.id,
          type: 'LOGIN_PATIENT',
          expiresAt,
          maxUses: 1,
        },
        select: { codeDisplay: true, expiresAt: true },
      });

      // payload pensado pro dashboard
      return {
        patient,
        loginCode: ac.codeDisplay,
        expiresAt: ac.expiresAt,
      };
    });
  }

  /**
   * Gera um novo código de login para um paciente já existente do cuidador (sem recriar paciente).
   */
  async generateAccessCodeForPatient(
    caregiverId: string,
    patientId: string,
    ttlMinutes?: number,
  ) {
    const cg = await this.prisma.user.findUnique({ where: { id: caregiverId } });
    if (!cg || cg.role !== 'CAREGIVER') throw new ForbiddenException('Apenas cuidadores');

    // garante vínculo do cuidador com o paciente
    const link = await this.prisma.caregiverPatient.findFirst({
      where: { caregiverId, patientId },
      select: { id: true },
    });
    if (!link) throw new ForbiddenException('Paciente não vinculado a este cuidador');

    // valida paciente
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
      select: { id: true, name: true },
    });
    if (!patient) throw new NotFoundException('Paciente não encontrado');

    const ttl = clampTtl(ttlMinutes);
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    const raw = norm(genNumeric(6));
    const codeDigest = crypto
      .createHmac('sha256', process.env.CODE_SECRET || 'dev')
      .update(raw)
      .digest('hex');
    const codeHash = await bcrypt.hash(raw, 10);

    const ac = await this.prisma.accessCode.create({
      data: {
        codeDigest,
        codeHash,
        codeDisplay: display(raw),
        caregiverId,
        patientId,
        type: 'LOGIN_PATIENT',
        expiresAt,
        maxUses: 1,
      },
      select: { codeDisplay: true, expiresAt: true },
    });

    return {
      patient,
      loginCode: ac.codeDisplay,
      expiresAt: ac.expiresAt,
    };
  }

  /**
   * Lista pacientes do cuidador (resumo para dashboard).
   */
  async myPatients(caregiverId: string) {
    const cg = await this.prisma.user.findUnique({ where: { id: caregiverId } });
    if (!cg || cg.role !== 'CAREGIVER') throw new ForbiddenException();

    const links = await this.prisma.caregiverPatient.findMany({
      where: { caregiverId },
      include: {
        patient: {
          include: {
            devices: { select: { id: true } },
            _count: { select: { fallAlerts: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return links.map((l) => ({
      id: l.patient.id,
      name: l.patient.name,
      age: l.patient.age,
      devices: l.patient.devices.length,
      fallAlertsCount: l.patient._count.fallAlerts,
      createdAt: l.patient.createdAt,
    }));
  }
}
