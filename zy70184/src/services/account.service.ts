import { Prisma, ReceivingAccount } from '@prisma/client';
import { prisma } from '../config/database';
import { ValidationError, NotFoundError } from '../utils/error';

export interface CreateAccountInput {
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  branchName?: string;
  accountType?: string;
  currency?: string;
  description?: string;
}

export const accountService = {
  async createAccount(input: CreateAccountInput): Promise<ReceivingAccount> {
    const exists = await prisma.receivingAccount.findUnique({
      where: { accountNumber: input.accountNumber },
    });
    if (exists) {
      throw new ValidationError('账户已存在', { accountNumber: input.accountNumber });
    }

    return prisma.receivingAccount.create({
      data: {
        accountNumber: input.accountNumber,
        accountName: input.accountName,
        bankCode: input.bankCode,
        bankName: input.bankName,
        branchName: input.branchName,
        accountType: input.accountType,
        currency: input.currency,
        description: input.description,
      },
    });
  },

  async getOrCreateAccount(
    accountNumber: string,
    accountName: string,
    bankCode: string,
    bankName: string,
    branchName?: string
  ): Promise<ReceivingAccount> {
    const existing = await prisma.receivingAccount.findUnique({
      where: { accountNumber },
    });

    if (existing) {
      if (!existing.isActive) {
        throw new ValidationError('收款账户已被禁用', { accountNumber });
      }
      if (existing.accountName !== accountName) {
        throw new ValidationError('账户名称与开户名不匹配', {
          accountNumber,
          providedName: accountName,
          registeredName: existing.accountName,
        });
      }
      return existing;
    }

    return prisma.receivingAccount.create({
      data: {
        accountNumber,
        accountName,
        bankCode,
        bankName,
        branchName,
        isVerified: false,
      },
    });
  },

  async getAccountById(id: string): Promise<ReceivingAccount> {
    const account = await prisma.receivingAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundError(`账户不存在: ${id}`);
    }
    return account;
  },

  async getAccountByNumber(accountNumber: string): Promise<ReceivingAccount | null> {
    return prisma.receivingAccount.findUnique({ where: { accountNumber } });
  },

  async listAccounts(params: {
    page: number;
    pageSize: number;
    isActive?: boolean;
    isVerified?: boolean;
    search?: string;
  }): Promise<{ items: ReceivingAccount[]; total: number }> {
    const where: Prisma.ReceivingAccountWhereInput = {};
    if (params.isActive !== undefined) where.isActive = params.isActive;
    if (params.isVerified !== undefined) where.isVerified = params.isVerified;
    if (params.search) {
      where.OR = [
        { accountNumber: { contains: params.search } },
        { accountName: { contains: params.search } },
        { bankName: { contains: params.search } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.receivingAccount.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.receivingAccount.count({ where }),
    ]);

    return { items, total };
  },

  async verifyAccount(id: string, operatorId: string, operatorName: string): Promise<ReceivingAccount> {
    const account = await this.getAccountById(id);
    if (account.isVerified) {
      return account;
    }

    return prisma.receivingAccount.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedBy: operatorId,
      },
    });
  },

  async toggleAccountStatus(id: string): Promise<ReceivingAccount> {
    const account = await this.getAccountById(id);
    return prisma.receivingAccount.update({
      where: { id },
      data: { isActive: !account.isActive },
    });
  },

  validateAccountFormat(accountNumber: string, bankCode: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!accountNumber || accountNumber.trim().length < 5) {
      errors.push('账号长度过短');
    }

    if (!/^\d+$/.test(accountNumber)) {
      errors.push('账号只能包含数字');
    }

    if (!bankCode || bankCode.trim().length < 3) {
      errors.push('银行代码格式不正确');
    }

    return { valid: errors.length === 0, errors };
  },
};
