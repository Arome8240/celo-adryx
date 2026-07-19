import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSavedTravelerDto } from './dto/create-saved-traveler.dto';

/** Saved-travelers, so a returning customer doesn't retype every companion's details on every booking. */
@Injectable()
export class TravelersService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.savedTraveler.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(userId: string, dto: CreateSavedTravelerDto) {
    return this.prisma.savedTraveler.create({
      data: {
        userId,
        title: dto.title,
        firstName: dto.firstName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        nationality: dto.nationality,
        documentType: dto.documentType,
        documentNumber: dto.documentNumber,
        documentExpiry: new Date(dto.documentExpiry),
        documentIssuingCountry: dto.documentIssuingCountry,
      },
    });
  }

  async remove(userId: string, id: string) {
    const traveler = await this.prisma.savedTraveler.findUnique({
      where: { id },
    });
    if (!traveler || traveler.userId !== userId) {
      throw new NotFoundException('Saved traveler not found');
    }
    await this.prisma.savedTraveler.delete({ where: { id } });
  }
}
