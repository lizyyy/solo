import { 
  Campaign, 
  CreateCampaignRequest, 
  UUID
} from '../types';
import { 
  getCampaignRepository,
  getBudgetPoolRepository
} from '../repositories/RepositoryFactory';
import { generateId } from '../utils/idGenerator';
import { 
  addAmount, 
  subtractAmount, 
  greaterThan,
  formatAmount 
} from '../utils/amount';
import { 
  CampaignNotFoundException,
  InsufficientBudgetException,
  EntityStateException,
  ValidationException
} from '../exceptions/AppException';
import { AuditService } from './AuditService';
import { BudgetPoolService } from './BudgetPoolService';

export class CampaignService {
  private static instance: CampaignService;

  private constructor() {}

  static getInstance(): CampaignService {
    if (!CampaignService.instance) {
      CampaignService.instance = new CampaignService();
    }
    return CampaignService.instance;
  }

  async createCampaign(request: CreateCampaignRequest, operator?: string): Promise<Campaign> {
    if (!request.name || request.name.trim().length === 0) {
      throw new ValidationException({ name: 'Name is required' });
    }
    if (!greaterThan(request.totalBudget, 0)) {
      throw new ValidationException({ totalBudget: 'Total budget must be greater than zero' });
    }

    const budgetPoolService = BudgetPoolService.getInstance();
    const budgetPool = await budgetPoolService.getBudgetPool(request.budgetPoolId);

    const allocatedAvailable = budgetPoolService.calculateAllocatedAvailable(budgetPool);
    if (greaterThan(request.totalBudget, allocatedAvailable)) {
      throw new InsufficientBudgetException(
        allocatedAvailable,
        request.totalBudget,
        'Campaign creation requires budget allocation from pool'
      );
    }

    await budgetPoolService.allocateBudget(
      budgetPool.id,
      'pending-campaign',
      request.totalBudget,
      operator
    );

    const campaign: Campaign = {
      id: generateId(),
      budgetPoolId: request.budgetPoolId,
      name: request.name,
      description: request.description,
      totalBudget: formatAmount(request.totalBudget),
      allocatedBudget: formatAmount(request.totalBudget),
      consumedBudget: 0,
      refundedBudget: 0,
      compensatedBudget: 0,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
      startDate: request.startDate,
      endDate: request.endDate,
    };

    const saved = await getCampaignRepository().save(campaign);

    await AuditService.getInstance().logAction(
      'CREATE_CAMPAIGN',
      'Campaign',
      saved.id,
      {
        operator,
        afterState: this.toLoggableState(saved),
        reason: 'Created new campaign',
      }
    );

    return saved;
  }

  async getCampaign(id: UUID): Promise<Campaign> {
    const campaign = await getCampaignRepository().findById(id);
    if (!campaign) {
      throw new CampaignNotFoundException(id);
    }
    return campaign;
  }

  async getAllCampaigns(): Promise<Campaign[]> {
    return getCampaignRepository().findAll();
  }

  async getCampaignsByBudgetPool(budgetPoolId: UUID): Promise<Campaign[]> {
    return getCampaignRepository().findByQuery({ budgetPoolId });
  }

  async activateCampaign(id: UUID, operator?: string): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'DRAFT') {
      throw new EntityStateException('Campaign', campaign.status, ['DRAFT']);
    }

    const beforeState = this.toLoggableState(campaign);
    campaign.status = 'ACTIVE';
    campaign.updatedAt = new Date();

    const saved = await getCampaignRepository().save(campaign);

    await AuditService.getInstance().logAction(
      'ACTIVATE_CAMPAIGN',
      'Campaign',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: 'Campaign activated',
      }
    );

    return saved;
  }

  async pauseCampaign(id: UUID, operator?: string, reason?: string): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'ACTIVE') {
      throw new EntityStateException('Campaign', campaign.status, ['ACTIVE']);
    }

    const beforeState = this.toLoggableState(campaign);
    campaign.status = 'PAUSED';
    campaign.updatedAt = new Date();

    const saved = await getCampaignRepository().save(campaign);

    await AuditService.getInstance().logAction(
      'PAUSE_CAMPAIGN',
      'Campaign',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: reason || 'Campaign paused',
      }
    );

    return saved;
  }

  async resumeCampaign(id: UUID, operator?: string): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (campaign.status !== 'PAUSED') {
      throw new EntityStateException('Campaign', campaign.status, ['PAUSED']);
    }

    const beforeState = this.toLoggableState(campaign);
    campaign.status = 'ACTIVE';
    campaign.updatedAt = new Date();

    const saved = await getCampaignRepository().save(campaign);

    await AuditService.getInstance().logAction(
      'RESUME_CAMPAIGN',
      'Campaign',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: 'Campaign resumed',
      }
    );

    return saved;
  }

  async completeCampaign(id: UUID, operator?: string, reason?: string): Promise<Campaign> {
    const campaign = await this.getCampaign(id);
    if (!['ACTIVE', 'PAUSED'].includes(campaign.status)) {
      throw new EntityStateException('Campaign', campaign.status, ['ACTIVE', 'PAUSED']);
    }

    const beforeState = this.toLoggableState(campaign);
    campaign.status = 'COMPLETED';
    campaign.updatedAt = new Date();

    const saved = await getCampaignRepository().save(campaign);

    await AuditService.getInstance().logAction(
      'COMPLETE_CAMPAIGN',
      'Campaign',
      saved.id,
      {
        operator,
        beforeState,
        afterState: this.toLoggableState(saved),
        reason: reason || 'Campaign completed',
      }
    );

    return saved;
  }

  private toLoggableState(campaign: Campaign): Record<string, any> {
    return {
      id: campaign.id,
      budgetPoolId: campaign.budgetPoolId,
      name: campaign.name,
      status: campaign.status,
      totalBudget: campaign.totalBudget,
      allocatedBudget: campaign.allocatedBudget,
      consumedBudget: campaign.consumedBudget,
      refundedBudget: campaign.refundedBudget,
      compensatedBudget: campaign.compensatedBudget,
      updatedAt: campaign.updatedAt,
    };
  }
}
