// caregiver/caregiver.service.ts
import {
  BadRequestException, ConflictException, ForbiddenException, Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { CreatePatientAndPairDto } from './dto/create-patient.dto';

function norm(code: string) { return code.replace(/[^0-9A-Za-z]/g, '').toUpperCase(); }
function genNumeric(len = 6){ let s=''; for(let i=0;i<len;i++) s+=Math.floor(Math.random()*10); return s; }
const display = (c:string)=> c.length===6?`${c.slice(0,3)}-${c.slice(3)}`:c;
function clampTtl(ttl?:number){ const raw=ttl??Number(process.env.ACCESS_CODE_TTL_MINUTES||30); return Math.min(Math.max(raw,1),1440); }

@Injectable()
export class CaregiverService {
  constructor(private prisma: PrismaService) {}

  async createPatientPairDeviceAndLoginCode(caregiverId: string, dto: CreatePatientAndPairDto) {
    const cg = await this.prisma.user.findUnique({ where: { id: caregiverId } });

    if (!cg || cg.role !== 'CAREGIVER') throw new ForbiddenException('Apenas cuidadores');

    if (!dto.deviceSerial || !dto.deviceApiKey) {
      throw new BadRequestException('Device obrigatório para cadastrar paciente.');
    }

    if (!dto.emergencyContacts?.length) {
      throw new BadRequestException('Envie ao menos um contato de emergência.');
    }

    const phones = dto.emergencyContacts.map(c => c.phone);
    if (new Set(phones).size !== phones.length) {
      throw new BadRequestException('Há telefones de contato repetidos no payload.');
    }

    const existing = await this.prisma.device.findUnique({
      where: { deviceIdentifier: dto.deviceSerial },
      select: { id: true, patientId: true },
    });
    if (existing?.patientId) {
      throw new ConflictException('Este dispositivo já está pareado com outro paciente.');
    }

    const ttl = clampTtl(dto.ttlMinutes);
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 1) Paciente
      const patient = await tx.user.create({
        data: {
          name: dto.name,
          birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
          gender: dto.gender ?? null,
          email: null,
          password: null,
          role: 'PATIENT',
          hasAccount: false,
        },
        select: { id: true, name: true, birthDate: true, gender: true, createdAt: true },
      });

      // 2) Vínculo
      await tx.caregiverPatient.create({ data: { caregiverId, patientId: patient.id } });

      // 3) Contatos (1..N)
      try {
        await Promise.all(
          dto.emergencyContacts.map((c, i) =>
            tx.emergencyContact.create({
              data: {
                name: (c.name?.trim() || cg.name || 'Contato'),
                phone: c.phone,
                patientId: patient.id,
                priority: c.priority ?? (i + 1),
              },
            }),
          )
        );
      } catch (e: any) {
        if (e?.code === 'P2002' && e?.meta?.target?.includes('phone')) {
          throw new BadRequestException('Telefone de contato já está em uso por outro paciente.');
        }
        throw e;
      }

      // 4) Parear device (OBRIGATÓRIO)
      const apiKeyHash = await bcrypt.hash(dto.deviceApiKey, 6);
      await tx.device.upsert({
        where: { deviceIdentifier: dto.deviceSerial },
        update: {
          apiKeyHash,
          patientId: patient.id,
          status: 'ACTIVE',
          pairedAt: new Date(),
          registeredAt: new Date(),
        },
        create: {
          deviceIdentifier: dto.deviceSerial,
          apiKeyHash,
          patientId: patient.id,
          status: 'ACTIVE',
          pairedAt: new Date(),
          registeredAt: new Date(),
        },
      });

      // 5) Código de login (one-shot)
      const raw = norm(genNumeric(6));
      const codeDigest = crypto.createHmac('sha256', process.env.CODE_SECRET || 'dev')
        .update(raw).digest('hex');
      const codeHash = await bcrypt.hash(raw, 10);
      const login = await tx.accessCode.create({
        data: {
          codeDigest, codeHash, codeDisplay: display(raw),
          caregiverId, patientId: patient.id, type: 'LOGIN_PATIENT',
          expiresAt, maxUses: 1,
        },
        select: { codeDisplay: true, expiresAt: true },
      });

      return {
        patient,
        emergencyContacts: dto.emergencyContacts.map((c, i) => ({
          name: c.name ?? cg.name ?? 'Contato',
          phone: c.phone,
          priority: c.priority ?? (i + 1),
        })),
        device: { deviceIdentifier: dto.deviceSerial },
        loginCode: login.codeDisplay,
        loginExpiresAt: login.expiresAt,
      };
    });
  }

  async renewLoginCode(caregiverId: string, patientId: string, ttlMinutes?: number) {
  // Validar se caregiver realmente é dono do vínculo
  const link = await this.prisma.caregiverPatient.findUnique({
    where: { caregiverId_patientId: { caregiverId, patientId } },
  });
  if (!link) throw new ForbiddenException('Você não pode renovar este código.');

  const ttl = clampTtl(ttlMinutes);
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

  const raw = norm(genNumeric(6));
  const codeDigest = crypto.createHmac('sha256', process.env.CODE_SECRET || 'dev')
    .update(raw).digest('hex');
  const codeHash = await bcrypt.hash(raw, 10);

  const login = await this.prisma.accessCode.create({
    data: {
      codeDigest, codeHash, codeDisplay: display(raw),
      caregiverId, patientId, type: 'LOGIN_PATIENT',
      expiresAt, maxUses: 1,
    },
    select: { codeDisplay: true, expiresAt: true },
  });

  return login;
}
}
