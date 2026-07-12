import { PrismaClient } from '@prisma/client';

// Set default DATABASE_URL if not provided
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/collaborative_workspace';
}

// Set default REDIS_URL if not provided
if (!process.env.REDIS_URL) {
    process.env.REDIS_URL = 'redis://localhost:6379';
}

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
