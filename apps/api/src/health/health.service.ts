import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ServiceStatus = 'up' | 'down';

export interface HealthReport {
  status: 'ok' | 'down';
  checks: { database: ServiceStatus };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', checks: { database: 'up' } };
    } catch {
      return { status: 'down', checks: { database: 'down' } };
    }
  }
}
