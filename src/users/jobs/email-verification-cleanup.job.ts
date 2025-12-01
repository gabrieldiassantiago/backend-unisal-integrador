import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class EmailVerificationCleanupJob {
    private readonly logger = new Logger(EmailVerificationCleanupJob.name);

    constructor(private readonly prisma: PrismaService) { }

    // Roda todo dia às 3h da manhã
    @Cron('0 3 * * *')
    async cleanup() {
        this.logger.log('🧹 Iniciando limpeza de códigos de verificação...');

        const now = new Date();

        const deleted = await this.prisma.emailVerification.deleteMany({
            where: {
                OR: [
                    // Códigos expirados
                    { expiresAt: { lt: now } },

                    // Códigos verificados há mais de 1 dia
                    {
                        verifiedAt: {
                            lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
                        },
                    },
                ],
            },
        });

    }
}
