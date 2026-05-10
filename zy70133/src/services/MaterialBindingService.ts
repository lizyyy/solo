import { 
  MaterialBinding, 
  BindMaterialRequest,
  UUID,
  Material,
  Campaign,
  Channel
} from '../types';
import { 
  getBindingRepository,
  getMaterialRepository,
  getCampaignRepository,
  getChannelRepository
} from '../repositories/RepositoryFactory';
import { generateId } from '../utils/idGenerator';
import { 
  addAmount, 
  subtractAmount, 
  greaterThan,
  formatAmount 
} from '../utils/amount';
import { 
  BindingNotFoundException,
  MaterialNotFoundException,
  CampaignNotFoundException,
  ChannelNotFoundException,
  EntityStateException,
  ValidationException,
  InvalidOperationException
} from '../exceptions/AppException';
import { AuditService } from './AuditService';
import { BudgetPoolService } from './BudgetPoolService';

export class MaterialBindingService {
  private static instance: MaterialBindingService;

  private constructor() {}

  static getInstance(): MaterialBindingService {
    if (!MaterialBindingService.instance) {
      MaterialBindingService.instance = new MaterialBindingService();
    }
    return MaterialBindingService.instance;
  }

  async bindMaterial(request: BindMaterialRequest, operator?: string): Promise<MaterialBinding> {
    if (!greaterThan(request.allocatedBudget, 0)) {
      throw new ValidationException({ allocatedBudget: 'Allocated budget must be greater than zero' });
    }

    const material = await this.getMaterialOrThrow(request.materialId);
    const campaign = await this.getCampaignOrThrow(request.campaignId);
    const channel = await this.getChannelOrThrow(request.channelId);

    if (material.status !== 'APPROVED') {
      throw new EntityStateException('Material', material.status, ['APPROVED']);
    }
    if (campaign.status !== 'ACTIVE') {
      throw new EntityStateException('Campaign', campaign.status, ['ACTIVE']);
    }
    if (channel.status !== 'ACTIVE') {
      throw new EntityStateException('Channel', channel.status, ['ACTIVE']);
    }

    const existingBinding = await getBindingRepository().findOneByQuery({
      materialId: request.materialId,
      campaignId: request.campaignId,
      channelId: request.channelId,
    });

    if (existingBinding) {
      throw new InvalidOperationException(
        'BIND_MATERIAL',
        'Material is already bound to this campaign and channel. Use update instead.'
      );
    }

    const binding: MaterialBinding = {
      id: generateId(),
      materialId: request.materialId,
      campaignId: request.campaignId,
      channelId: request.channelId,
      status: 'ACTIVE',
      priority: request.priority || 0,
      allocatedBudget: formatAmount(request.allocatedBudget),
      consumedBudget: 0,
      refundedBudget: 0,
      compensatedBudget: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      startDate: request.startDate,
      endDate: request.endDate,
    };

    const saved = await getBindingRepository().save(binding);

    await AuditService.getInstance().logAction(
      'BIND_MATERIAL',
      'MaterialBinding',
      saved.id,
      {
        operator,
        afterState: this.toLoggableState(saved),
        reason: `Bound material ${request.materialId} to campaign ${request.campaignId} on channel ${request.channelId}`,
      }
    );

    return saved;
  }

  async getBinding(id: UUID): Promise<MaterialBinding> {
    const binding = await getBindingRepository().findById(id);
    if (!binding) {
      throw new BindingNotFoundException(id);
    }
    return binding;
  }

  async getBindingsByCampaign(campaignId: UUID): Promise<MaterialBinding[]> {
    return getBindingRepository().findByQuery({ campaignId });
  }

  async getBindingsByChannel(channelId: UUID): Promise<MaterialBinding[]> {
    return getBindingRepository().findByQuery({ channelId });
  }

  async getActiveBindings(campaignId: UUID, channelId: UUID): Promise<MaterialBinding[]> {
    const bindings = await getBindingRepository().findByQuery({
      campaignId,
      channelId,
      status: 'ACTIVE',
    });
    return bindings.sort((a, b) => a.priority - b.priority);
  }

  async unbindMaterial(id: UUID, operator?: string, reason?: string): Promise<MaterialBinding> {
    const binding = await this.getBinding(id);
    const beforeState = this.toLoggableState(binding);

    if (binding.status === 'UNBOUND') {
      throw new InvalidOperationException(
        'UNBIND_MATERIAL',
        'Material is already unbound'
      );
    }

    binding.status = 'UNBOUND';
    binding.updatedAt = new Date();

    const saved = await getBindingRepository().save(binding);

    await AuditService.getInstance().logAction(
      'UNBIND_MATERIAL',
      'MaterialBinding',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: reason || 'Material unbound',
      }
    );

    return saved;
  }

  async pauseBinding(id: UUID, operator?: string, reason?: string): Promise<MaterialBinding> {
    const binding = await this.getBinding(id);
    const beforeState = this.toLoggableState(binding);

    if (binding.status !== 'ACTIVE') {
      throw new EntityStateException('MaterialBinding', binding.status, ['ACTIVE']);
    }

    binding.status = 'PAUSED';
    binding.updatedAt = new Date();

    const saved = await getBindingRepository().save(binding);

    await AuditService.getInstance().logAction(
      'PAUSE_BINDING',
      'MaterialBinding',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: reason || 'Binding paused',
      }
    );

    return saved;
  }

  async resumeBinding(id: UUID, operator?: string): Promise<MaterialBinding> {
    const binding = await this.getBinding(id);
    const beforeState = this.toLoggableState(binding);

    if (binding.status !== 'PAUSED') {
      throw new EntityStateException('MaterialBinding', binding.status, ['PAUSED']);
    }

    binding.status = 'ACTIVE';
    binding.updatedAt = new Date();

    const saved = await getBindingRepository().save(binding);

    await AuditService.getInstance().logAction(
      'RESUME_BINDING',
      'MaterialBinding',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: 'Binding resumed',
      }
    );

    return saved;
  }

  async updateAllocatedBudget(id: UUID, newAllocation: number, operator?: string): Promise<MaterialBinding> {
    if (!greaterThan(newAllocation, 0)) {
      throw new ValidationException({ newAllocation: 'Allocated budget must be greater than zero' });
    }

    const binding = await this.getBinding(id);
    const beforeState = this.toLoggableState(binding);

    binding.allocatedBudget = formatAmount(newAllocation);
    binding.updatedAt = new Date();

    const saved = await getBindingRepository().save(binding);

    await AuditService.getInstance().logAction(
      'UPDATE_ALLOCATED_BUDGET',
      'MaterialBinding',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: `Updated allocated budget from ${binding.allocatedBudget} to ${newAllocation}`,
      }
    );

    return saved;
  }

  private async getMaterialOrThrow(id: UUID): Promise<Material> {
    const material = await getMaterialRepository().findById(id);
    if (!material) {
      throw new MaterialNotFoundException(id);
    }
    return material;
  }

  private async getCampaignOrThrow(id: UUID): Promise<Campaign> {
    const campaign = await getCampaignRepository().findById(id);
    if (!campaign) {
      throw new CampaignNotFoundException(id);
    }
    return campaign;
  }

  private async getChannelOrThrow(id: UUID): Promise<Channel> {
    const channel = await getChannelRepository().findById(id);
    if (!channel) {
      throw new ChannelNotFoundException(id);
    }
    return channel;
  }

  private toLoggableState(binding: MaterialBinding): Record<string, any> {
    return {
      id: binding.id,
      materialId: binding.materialId,
      campaignId: binding.campaignId,
      channelId: binding.channelId,
      status: binding.status,
      priority: binding.priority,
      allocatedBudget: binding.allocatedBudget,
      consumedBudget: binding.consumedBudget,
      refundedBudget: binding.refundedBudget,
      compensatedBudget: binding.compensatedBudget,
      updatedAt: binding.updatedAt,
    };
  }
}
