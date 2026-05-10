import { BudgetPoolService } from '../services/BudgetPoolService';
import { CampaignService } from '../services/CampaignService';
import { ResourceService } from '../services/ResourceService';
import { MaterialBindingService } from '../services/MaterialBindingService';
import { TransactionService } from '../services/TransactionService';
import { ReportService } from '../services/ReportService';
import { resetAllRepositories } from '../repositories/RepositoryFactory';
import { 
  greaterThan, 
  subtractAmount, 
  equals,
  addAmount 
} from '../utils/amount';
import moment from 'moment';

describe('广告预算消耗 API 完整链路测试', () => {
  beforeEach(() => {
    resetAllRepositories();
  });

  describe('基础链路：预算池→素材绑定→扣费→退款', () => {
    it('应该能够创建预算池并检查初始状态', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      
      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '2024 Q3 主预算池',
        description: '第三季度广告投放主预算',
        totalAmount: 100000,
        dailyLimit: 5000,
      }, 'admin');

      expect(budgetPool.id).toBeDefined();
      expect(budgetPool.name).toBe('2024 Q3 主预算池');
      expect(budgetPool.totalAmount).toBe(100000);
      expect(budgetPool.status).toBe('ACTIVE');
      expect(budgetPool.dailyLimit).toBe(5000);
    });

    it('应该能够创建完整的广告投放链路并成功扣费', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '测试预算池',
        totalAmount: 50000,
        dailyLimit: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '618活动横幅',
        type: 'IMAGE',
      }, 'designer');

      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');
      expect(approvedMaterial.status).toBe('APPROVED');

      const channel = await resourceService.createChannel({
        name: '字节跳动-抖音',
        type: 'SOCIAL',
        feeRate: 0.05,
        rules: [
          { type: 'MIN_DEDUCT', value: 10, description: '最低扣费10元' },
        ],
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '618大促活动',
        totalBudget: 30000,
      }, 'marketer');

      const activatedCampaign = await campaignService.activateCampaign(campaign.id, 'marketer');
      expect(activatedCampaign.status).toBe('ACTIVE');

      const binding = await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: activatedCampaign.id,
        channelId: channel.id,
        allocatedBudget: 15000,
        priority: 1,
      }, 'ad_ops');

      expect(binding.status).toBe('ACTIVE');

      const transaction = await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: activatedCampaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 500,
        reason: '抖音信息流广告消耗',
        operator: 'traffic',
      });

      expect(transaction.status).toBe('SUCCESS');
      expect(transaction.type).toBe('DEDUCT');
      expect(transaction.amount).toBe(500);
      expect(transaction.ruleEvaluation).toBeDefined();
      expect(transaction.ruleEvaluation?.passed).toBe(true);

      const availableAmount = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAmount).toBe(subtractAmount(50000, 500));
    });

    it('应该能够成功退款并正确恢复预算', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '退款测试预算池',
        totalAmount: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '退款测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '退款测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      const deductTransaction = await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 1000,
        reason: '测试扣费',
        operator: 'traffic',
      });

      const availableAfterDeduct = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAfterDeduct).toBe(9000);

      const refundTransaction = await transactionService.refund({
        transactionId: deductTransaction.id,
        amount: 500,
        reason: '系统误扣费，需退款',
        operator: 'finance',
      });

      expect(refundTransaction.status).toBe('SUCCESS');
      expect(refundTransaction.type).toBe('REFUND');
      expect(refundTransaction.amount).toBe(500);

      const availableAfterRefund = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAfterRefund).toBe(9500);
    });

    it('应该能够补量并正确更新预算', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '补量测试预算池',
        totalAmount: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '补量测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '补量测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      const deductTransaction = await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 2000,
        reason: '测试扣费',
        operator: 'traffic',
      });

      const availableAfterDeduct = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAfterDeduct).toBe(8000);

      const compensateTransaction = await transactionService.compensate({
        budgetPoolId: budgetPool.id,
        transactionId: deductTransaction.id,
        amount: 300,
        reason: '渠道曝光量不足，补偿300元',
        operator: 'operation',
      });

      expect(compensateTransaction.status).toBe('SUCCESS');
      expect(compensateTransaction.type).toBe('COMPENSATE');
      expect(compensateTransaction.amount).toBe(300);

      const availableAfterCompensate = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAfterCompensate).toBe(8300);
    });

    it('应该能够回滚交易', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '回滚测试预算池',
        totalAmount: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '回滚测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '回滚测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      const deductTransaction = await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 3000,
        reason: '测试扣费',
        operator: 'traffic',
      });

      const availableAfterDeduct = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAfterDeduct).toBe(7000);

      const revertTransaction = await transactionService.revert({
        transactionId: deductTransaction.id,
        reason: '发现操作错误，需要回滚该交易',
        operator: 'admin',
      });

      expect(revertTransaction.status).toBe('SUCCESS');
      expect(revertTransaction.type).toBe('REVERT');
      expect(revertTransaction.amount).toBe(3000);

      const updatedDeductTransaction = await transactionService.getTransaction(deductTransaction.id);
      expect(updatedDeductTransaction.status).toBe('REVERTED');

      const availableAfterRevert = await budgetPoolService.getAvailableAmount(budgetPool.id);
      expect(availableAfterRevert).toBe(10000);
    });
  });

  describe('规则引擎和超支拦截', () => {
    it('应该拦截超出预算池的扣费请求', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '超支测试预算池',
        totalAmount: 1000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '超支测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '超支测试活动',
        totalBudget: 1000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 1000,
      }, 'ad_ops');

      await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 800,
        reason: '测试扣费',
        operator: 'traffic',
      });

      await expect(
        transactionService.deduct({
          budgetPoolId: budgetPool.id,
          campaignId: campaign.id,
          materialId: approvedMaterial.id,
          channelId: channel.id,
          amount: 500,
          reason: '应该失败的扣费',
          operator: 'traffic',
        })
      ).rejects.toThrow();
    });

    it('应该拦截超出日限额的扣费请求', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '日限额测试预算池',
        totalAmount: 10000,
        dailyLimit: 1000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '日限额测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '日限额测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 800,
        reason: '测试扣费',
        operator: 'traffic',
      });

      await expect(
        transactionService.deduct({
          budgetPoolId: budgetPool.id,
          campaignId: campaign.id,
          materialId: approvedMaterial.id,
          channelId: channel.id,
          amount: 400,
          reason: '应该失败的扣费-超出日限额',
          operator: 'traffic',
        })
      ).rejects.toThrow();
    });

    it('应该拦截不活跃的素材绑定扣费', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '状态测试预算池',
        totalAmount: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '状态测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '状态测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      const binding = await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      await bindingService.pauseBinding(binding.id, 'admin', '临时暂停投放');

      await expect(
        transactionService.deduct({
          budgetPoolId: budgetPool.id,
          campaignId: campaign.id,
          materialId: approvedMaterial.id,
          channelId: channel.id,
          amount: 100,
          reason: '应该失败的扣费-绑定已暂停',
          operator: 'traffic',
        })
      ).rejects.toThrow();
    });
  });

  describe('报表和历史记录', () => {
    it('应该能够生成正确的预算汇总报表', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();
      const reportService = ReportService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '报表测试预算池',
        totalAmount: 50000,
        dailyLimit: 10000,
      }, 'admin');

      const material1 = await resourceService.createMaterial({
        name: '素材A',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial1 = await resourceService.approveMaterial(material1.id, 'reviewer');

      const material2 = await resourceService.createMaterial({
        name: '素材B',
        type: 'VIDEO',
      }, 'designer');
      const approvedMaterial2 = await resourceService.approveMaterial(material2.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '报表测试活动',
        totalBudget: 30000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial1.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 15000,
        priority: 1,
      }, 'ad_ops');

      await bindingService.bindMaterial({
        materialId: approvedMaterial2.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 15000,
        priority: 2,
      }, 'ad_ops');

      await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial1.id,
        channelId: channel.id,
        amount: 1000,
        reason: '素材A扣费',
        operator: 'traffic',
      });

      await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial2.id,
        channelId: channel.id,
        amount: 2000,
        reason: '素材B扣费',
        operator: 'traffic',
      });

      const summary = await reportService.getBudgetSummary(budgetPool.id);

      expect(summary.budgetPoolId).toBe(budgetPool.id);
      expect(summary.totalAmount).toBe(50000);
      expect(summary.consumedAmount).toBe(3000);
      expect(summary.availableAmount).toBe(47000);

      expect(summary.campaignSummaries.length).toBe(1);
      const campaignSummary = summary.campaignSummaries[0];
      expect(campaignSummary.totalBudget).toBe(30000);
      expect(campaignSummary.consumedBudget).toBe(3000);

      expect(campaignSummary.channelSummaries.length).toBe(1);
      const channelSummary = campaignSummary.channelSummaries[0];
      expect(channelSummary.consumedAmount).toBe(3000);

      expect(channelSummary.materialSummaries.length).toBe(2);
      const materialASummary = channelSummary.materialSummaries.find(
        m => m.materialName === '素材A'
      );
      const materialBSummary = channelSummary.materialSummaries.find(
        m => m.materialName === '素材B'
      );
      expect(materialASummary?.consumedAmount).toBe(1000);
      expect(materialBSummary?.consumedAmount).toBe(2000);
    });

    it('应该能够导出交易记录为 CSV', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();
      const reportService = ReportService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: 'CSV导出测试预算池',
        totalAmount: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '导出测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: 'CSV导出测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 500,
        reason: '测试扣费1',
        operator: 'traffic',
      });

      await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 300,
        reason: '测试扣费2',
        operator: 'traffic',
      });

      const csv = await reportService.exportTransactionsToCsv({
        budgetPoolId: budgetPool.id,
        groupBy: 'DATE',
      });

      expect(csv).toContain('Transaction ID');
      expect(csv).toContain('Type');
      expect(csv).toContain('Amount');
      expect(csv).toContain('测试扣费');
      expect(csv).toContain('500');
      expect(csv).toContain('300');
    });

    it('应该能够查看交易历史记录', async () => {
      const budgetPoolService = BudgetPoolService.getInstance();
      const campaignService = CampaignService.getInstance();
      const resourceService = ResourceService.getInstance();
      const bindingService = MaterialBindingService.getInstance();
      const transactionService = TransactionService.getInstance();

      const budgetPool = await budgetPoolService.createBudgetPool({
        name: '历史记录测试预算池',
        totalAmount: 10000,
      }, 'admin');

      const material = await resourceService.createMaterial({
        name: '历史记录测试素材',
        type: 'IMAGE',
      }, 'designer');
      const approvedMaterial = await resourceService.approveMaterial(material.id, 'reviewer');

      const channel = await resourceService.createChannel({
        name: '测试渠道',
        type: 'SOCIAL',
        feeRate: 0.05,
      }, 'operator');

      const campaign = await campaignService.createCampaign({
        budgetPoolId: budgetPool.id,
        name: '历史记录测试活动',
        totalBudget: 5000,
      }, 'marketer');
      await campaignService.activateCampaign(campaign.id, 'marketer');

      await bindingService.bindMaterial({
        materialId: approvedMaterial.id,
        campaignId: campaign.id,
        channelId: channel.id,
        allocatedBudget: 5000,
      }, 'ad_ops');

      const deductTransaction = await transactionService.deduct({
        budgetPoolId: budgetPool.id,
        campaignId: campaign.id,
        materialId: approvedMaterial.id,
        channelId: channel.id,
        amount: 1000,
        reason: '测试扣费',
        operator: 'traffic',
      });

      const refundTransaction = await transactionService.refund({
        transactionId: deductTransaction.id,
        amount: 200,
        reason: '部分退款',
        operator: 'finance',
      });

      const history = await transactionService.getTransactionHistory(deductTransaction.id);

      expect(history.length).toBe(2);
      expect(history[0].type).toBe('DEDUCT');
      expect(history[0].amount).toBe(1000);
      expect(history[1].type).toBe('REFUND');
      expect(history[1].amount).toBe(200);
      expect(history[1].relatedTransactionId).toBe(deductTransaction.id);
    });
  });
});
