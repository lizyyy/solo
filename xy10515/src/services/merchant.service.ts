import prisma from '../utils/prisma';
import { MerchantStatus } from '../types';
import { BusinessError } from '../utils/response';
import { v4 as uuidv4 } from 'uuid';

export interface CreateMerchantDTO {
  name: string;
  phone?: string;
  contactName?: string;
  bankAccount?: string;
  bankName?: string;
}

export interface UpdateMerchantDTO {
  name?: string;
  phone?: string;
  contactName?: string;
  bankAccount?: string;
  bankName?: string;
  status?: MerchantStatus;
  operator?: string;
}

export async function createMerchant(dto: CreateMerchantDTO) {
  const merchantNo = `M${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  
  return prisma.merchant.create({
    data: {
      merchantNo,
      name: dto.name,
      phone: dto.phone,
      contactName: dto.contactName,
      bankAccount: dto.bankAccount,
      bankName: dto.bankName,
    },
  });
}

export async function getMerchantById(id: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    include: {
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;
  return merchant;
}

export async function getMerchantByNo(merchantNo: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { merchantNo },
    include: {
      statusHistory: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  
  if (!merchant) throw BusinessError.MERCHANT_NOT_FOUND;
  return merchant;
}

export async function updateMerchant(id: string, dto: UpdateMerchantDTO) {
  const merchant = await getMerchantById(id);
  
  const updateData: any = {
    name: dto.name,
    phone: dto.phone,
    contactName: dto.contactName,
    bankAccount: dto.bankAccount,
    bankName: dto.bankName,
  };

  if (dto.status && dto.status !== merchant.status) {
    updateData.status = dto.status;
    
    return prisma.$transaction(async (tx) => {
      const updated = await tx.merchant.update({
        where: { id },
        data: updateData,
      });

      await tx.merchantStatusHistory.create({
        data: {
          merchantId: id,
          oldStatus: merchant.status,
          newStatus: dto.status!,
          reason: '管理员更新状态',
          operator: dto.operator,
        },
      });

      return updated;
    });
  }

  return prisma.merchant.update({
    where: { id },
    data: updateData,
  });
}

export async function listMerchants(page: number = 1, pageSize: number = 20) {
  const skip = (page - 1) * pageSize;
  
  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.merchant.count(),
  ]);

  return {
    merchants,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}
