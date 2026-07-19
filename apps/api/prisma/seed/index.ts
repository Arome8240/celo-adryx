import 'dotenv/config';
import { PrismaClient } from '../../generated/prisma/client';
import { AIRPORT_SEEDS } from './airports';

async function main() {
  const prisma = new PrismaClient();

  for (const airport of AIRPORT_SEEDS) {
    await prisma.airport.upsert({
      where: { iataCode: airport.iataCode },
      update: airport,
      create: airport,
    });
  }
  console.log(`Seeded ${AIRPORT_SEEDS.length} airports.`);

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
