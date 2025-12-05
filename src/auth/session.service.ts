import { Injectable } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "@src/prisma/prisma.service";

@Injectable()

export class SessionService {
    constructor(
        private prismaService: PrismaService
    ) { }

    async createSession(userId: string): Promise<string> {

        const sessionId = uuidv4();

        await this.prismaService.user.update({
            where: { id: userId },
            data: { currentSessionId: sessionId },
        });

        return sessionId;

    }

    async invalidateSession(userId: string): Promise<{ message: string }> {

        await this.prismaService.user.update({
            where: { id: userId },
            data: { currentSessionId: null },
        })

        return {
            message: "Sessão invalidada com sucesso"
        };

    }
}