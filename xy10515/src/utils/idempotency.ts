import prisma from './prisma';
import dayjs from 'dayjs';
import { v4 as uuidv4 } from 'uuid';

export interface IdempotencyResult {
  exists: boolean;
  response?: string;
  resourceId?: string;
}

export async function checkIdempotency(
  idempotencyKey: string,
  operationType: string
): Promise<IdempotencyResult> {
  const record = await prisma.idempotencyRecord.findUnique({
    where: { idempotencyKey },
  });

  if (record) {
    return {
      exists: true,
      response: record.response || undefined,
      resourceId: record.resourceId || undefined,
    };
  }

  return { exists: false };
}

export async function createIdempotencyRecord(
  idempotencyKey: string,
  operationType: string,
  resourceId?: string,
  response?: string
): Promise<void> {
  await prisma.idempotencyRecord.create({
    data: {
      idempotencyKey,
      operationType,
      resourceId: resourceId || uuidv4(),
      response,
      expiresAt: dayjs().add(24, 'hour').toDate(),
    },
  });
}

export async function updateIdempotencyResponse(
  idempotencyKey: string,
  response: string,
  resourceId?: string
): Promise<void> {
  await prisma.idempotencyRecord.update({
    where: { idempotencyKey },
    data: {
      response,
      resourceId: resourceId || undefined,
    },
  });
}
