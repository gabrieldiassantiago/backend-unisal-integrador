import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => { 
  let service: AuthService;
  let prismaService: jest.Mock<PrismaService>;
  let jwtService: jest.Mock<JwtService>;  

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, PrismaService, JwtService],
    }).compile();
  })

  


})