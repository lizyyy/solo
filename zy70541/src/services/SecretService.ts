import prisma from '../utils/prisma';
import { createError } from '../utils/errors';
import type { CreateSecretInput, UpdateSecretStatusInput, QuerySecretsInput } from '../utils/validation';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ['DEPRECATED'],
  DEPRECATED: ['PENDING_DELETION'],
  PENDING_DELETION: [],
};

export class SecretService {
  async createSecret(data: CreateSecretInput) {
    const existing = await prisma.secret.findUnique({
      where: { name: data.name },
    });

    if (existing) {
      throw createError('SECRET_ALREADY_EXISTS', 409, {
        raw_input: data,
        processing_basis: '唯一性约束：Secret名称必须唯一',
        conclusion: '创建失败，Secret已存在',
      });
    }

    return prisma.secret.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });
  }

  async getSecretByName(name: string) {
    const secret = await prisma.secret.findUnique({
      where: { name },
      include: {
        references: true,
        replacements: true,
        access_logs: { take: 10, orderBy: { accessed_at: 'desc' } },
        corrections: true,
      },
    });

    if (!secret) {
      throw createError('SECRET_NOT_FOUND', 404, {
        raw_input: { name },
        processing_basis: '数据库中未找到该Secret',
        conclusion: '查询失败，Secret不存在',
      });
    }

    return secret;
  }

  async querySecrets(params: QuerySecretsInput) {
    const { name, status, environment, page, page_size } = params;

    const where: any = {};

    if (name) {
      where.name = { contains: name };
    }

    if (status) {
      where.status = status;
    }

    if (environment) {
      where.references = {
        some: {
          environment,
        },
      };
    }

    const [secrets, total] = await Promise.all([
      prisma.secret.findMany({
        where,
        skip: (page - 1) * page_size,
        take: page_size,
        orderBy: { created_at: 'desc' },
        include: {
          _count: {
            select: { references: true },
          },
        },
      }),
      prisma.secret.count({ where }),
    ]);

    return {
      data: secrets,
      pagination: {
        page,
        page_size,
        total,
        total_pages: Math.ceil(total / page_size),
      },
    };
  }

  async updateSecretStatus(name: string, data: UpdateSecretStatusInput) {
    const secret = await this.getSecretByName(name);

    const allowedTransitions = STATUS_TRANSITIONS[secret.status] || [];
    if (!allowedTransitions.includes(data.status)) {
      throw createError('INVALID_STATUS_TRANSITION', 400, {
        raw_input: { name, target_status: data.status, current_status: secret.status },
        processing_basis: `状态机规则：${secret.status} 只能转换为 ${allowedTransitions.join(', ') || '无'}`,
        conclusion: '状态转换被拒绝',
      });
    }

    return prisma.secret.update({
      where: { name },
      data: { status: data.status },
    });
  }

  async deleteSecret(name: string, force: boolean = false) {
    const secret = await this.getSecretByName(name);

    const activeReferences = await prisma.reference.findMany({
      where: {
        secret_id: secret.id,
        is_active: true,
      },
    });

    if (!force && activeReferences.length > 0) {
      throw createError('SECRET_HAS_ACTIVE_REFERENCES', 400, {
        raw_input: { name, force },
        processing_basis: '删除保护规则：存在活跃引用时禁止删除',
        conclusion: '删除被拦截',
        references: activeReferences.map(r => ({
          service: r.service_name,
          environment: r.environment,
          last_access: r.last_access,
        })),
      });
    }

    await prisma.secret.delete({
      where: { name },
    });

    return { success: true, deleted_references: activeReferences.length };
  }

  async getErrors(page: number = 1, pageSize: number = 20) {
    const [errors, total] = await Promise.all([
      prisma.errorRecord.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { occurred_at: 'desc' },
      }),
      prisma.errorRecord.count(),
    ]);

    return {
      data: errors,
      pagination: {
        page,
        page_size: pageSize,
        total,
        total_pages: Math.ceil(total / pageSize),
      },
    };
  }
}

export default new SecretService();
