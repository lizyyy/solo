import { 
  Material, 
  Channel,
  CreateMaterialRequest,
  CreateChannelRequest,
  UUID
} from '../types';
import { 
  getMaterialRepository,
  getChannelRepository
} from '../repositories/RepositoryFactory';
import { generateId } from '../utils/idGenerator';
import { 
  MaterialNotFoundException,
  ChannelNotFoundException,
  ValidationException,
  EntityStateException
} from '../exceptions/AppException';
import { AuditService } from './AuditService';

export class ResourceService {
  private static instance: ResourceService;

  private constructor() {}

  static getInstance(): ResourceService {
    if (!ResourceService.instance) {
      ResourceService.instance = new ResourceService();
    }
    return ResourceService.instance;
  }

  async createMaterial(request: CreateMaterialRequest, operator?: string): Promise<Material> {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationException({ name: 'Name is required' });
    }
    if (!['IMAGE', 'VIDEO', 'TEXT', 'HTML'].includes(request.type)) {
      throw new ValidationException({ type: 'Invalid material type' });
    }

    const material: Material = {
      id: generateId(),
      name: request.name,
      description: request.description,
      type: request.type,
      status: 'PENDING_REVIEW',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: request.metadata,
    };

    const saved = await getMaterialRepository().save(material);

    await AuditService.getInstance().logAction(
      'CREATE_MATERIAL',
      'Material',
      saved.id,
      {
        operator,
        afterState: this.toLoggableMaterialState(saved),
        reason: 'Created new material',
      }
    );

    return saved;
  }

  async getMaterial(id: UUID): Promise<Material> {
    const material = await getMaterialRepository().findById(id);
    if (!material) {
      throw new MaterialNotFoundException(id);
    }
    return material;
  }

  async getAllMaterials(): Promise<Material[]> {
    return getMaterialRepository().findAll();
  }

  async approveMaterial(id: UUID, operator?: string): Promise<Material> {
    const material = await this.getMaterial(id);
    if (material.status !== 'PENDING_REVIEW') {
      throw new EntityStateException('Material', material.status, ['PENDING_REVIEW']);
    }

    const beforeState = this.toLoggableMaterialState(material);
    material.status = 'APPROVED';
    material.updatedAt = new Date();

    const saved = await getMaterialRepository().save(material);

    await AuditService.getInstance().logAction(
      'APPROVE_MATERIAL',
      'Material',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableMaterialState(saved),
        reason: 'Material approved',
      }
    );

    return saved;
  }

  async rejectMaterial(id: UUID, operator?: string, reason?: string): Promise<Material> {
    const material = await this.getMaterial(id);
    if (material.status !== 'PENDING_REVIEW') {
      throw new EntityStateException('Material', material.status, ['PENDING_REVIEW']);
    }

    const beforeState = this.toLoggableMaterialState(material);
    material.status = 'REJECTED';
    material.updatedAt = new Date();

    const saved = await getMaterialRepository().save(material);

    await AuditService.getInstance().logAction(
      'REJECT_MATERIAL',
      'Material',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableMaterialState(saved),
        reason: reason || 'Material rejected',
      }
    );

    return saved;
  }

  async createChannel(request: CreateChannelRequest, operator?: string): Promise<Channel> {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationException({ name: 'Name is required' });
    }
    if (!['SEARCH', 'SOCIAL', 'DISPLAY', 'VIDEO', 'NATIVE'].includes(request.type)) {
      throw new ValidationException({ type: 'Invalid channel type' });
    }
    if (request.feeRate < 0 || request.feeRate > 1) {
      throw new ValidationException({ feeRate: 'Fee rate must be between 0 and 1' });
    }

    const channel: Channel = {
      id: generateId(),
      name: request.name,
      description: request.description,
      type: request.type,
      feeRate: request.feeRate,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      rules: request.rules || [],
    };

    const saved = await getChannelRepository().save(channel);

    await AuditService.getInstance().logAction(
      'CREATE_CHANNEL',
      'Channel',
      saved.id,
      {
        operator,
        afterState: this.toLoggableChannelState(saved),
        reason: 'Created new channel',
      }
    );

    return saved;
  }

  async getChannel(id: UUID): Promise<Channel> {
    const channel = await getChannelRepository().findById(id);
    if (!channel) {
      throw new ChannelNotFoundException(id);
    }
    return channel;
  }

  async getAllChannels(): Promise<Channel[]> {
    return getChannelRepository().findAll();
  }

  private toLoggableMaterialState(material: Material): Record<string, any> {
    return {
      id: material.id,
      name: material.name,
      type: material.type,
      status: material.status,
      updatedAt: material.updatedAt,
    };
  }

  private toLoggableChannelState(channel: Channel): Record<string, any> {
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      status: channel.status,
      feeRate: channel.feeRate,
      updatedAt: channel.updatedAt,
    };
  }
}
