const { PolicyVersion, PolicyStatus } = require('../models/PolicyVersion');
const { ApprovalNode, ApprovalStatus } = require('../models/ApprovalNode');
const { PublishChannel, ChannelStatus } = require('../models/PublishChannel');
const { ReadingConfirmation } = require('../models/ReadingConfirmation');
const { AbolishRecord } = require('../models/AbolishRecord');
const { PolicyReference } = require('../models/PolicyReference');

class PolicyService {
  static async createPolicy(data, createdBy) {
    const versions = await PolicyVersion.findByPolicyCode(data.policyCode);
    const nextVersion = versions.length > 0 ? Math.max(...versions.map(v => v.versionNumber)) + 1 : 1;
    
    const policy = await PolicyVersion.create({
      ...data,
      versionNumber: data.versionNumber || nextVersion
    }, createdBy);
    
    if (data.approvalNodes && data.approvalNodes.length > 0) {
      await ApprovalNode.create(policy.id, data.approvalNodes);
    }
    
    if (data.publishChannels && data.publishChannels.length > 0) {
      await PublishChannel.create(policy.id, data.publishChannels);
    }
    
    if (data.references && data.references.length > 0) {
      await PolicyReference.create(policy.id, data.references);
    }
    
    return policy;
  }

  static async submitForApproval(policyVersionId) {
    const policy = await PolicyVersion.findById(policyVersionId);
    if (!policy) throw new Error('制度不存在');
    if (policy.status !== PolicyStatus.DRAFT) throw new Error('只有草稿状态可以提交审批');
    
    const nodes = await ApprovalNode.findByPolicyVersionId(policyVersionId);
    if (nodes.length === 0) throw new Error('未设置审批节点');
    
    await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.PENDING_APPROVAL);
    await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.APPROVING);
    
    return { policy: await PolicyVersion.findById(policyVersionId), currentNode: nodes[0] };
  }

  static async findNodeById(nodeId) {
    const policies = await PolicyVersion.findAll({});
    for (const p of policies) {
      const nodes = await ApprovalNode.findByPolicyVersionId(p.id);
      const node = nodes.find(n => n.id === nodeId);
      if (node) return node;
    }
    return null;
  }

  static async approveNode(nodeId, approverUser, comment) {
    const node = await this.findNodeById(nodeId);
    if (!node) throw new Error('审批节点不存在');
    
    const policyVersionId = node.policyVersionId;
    const allNodes = await ApprovalNode.findByPolicyVersionId(policyVersionId);
    
    const pendingNodes = allNodes.filter(n => n.status === ApprovalStatus.PENDING);
    const firstPendingNode = pendingNodes.length > 0 ? pendingNodes[0] : null;
    
    if (node.status !== ApprovalStatus.PENDING) {
      throw new Error('该节点无需审批');
    }
    
    if (firstPendingNode && firstPendingNode.nodeOrder !== node.nodeOrder) {
      throw new Error(`审批必须按顺序进行，当前应审批节点：${firstPendingNode.nodeName}`);
    }
    
    await ApprovalNode.approve(nodeId, approverUser, comment);
    
    const updatedNodes = await ApprovalNode.findByPolicyVersionId(policyVersionId);
    const remainingPending = updatedNodes.filter(n => n.status === ApprovalStatus.PENDING);
    
    if (remainingPending.length === 0) {
      await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.APPROVED);
      return { status: 'ALL_APPROVED', policy: await PolicyVersion.findById(policyVersionId) };
    }
    
    return { status: 'NEXT_NODE', nextNode: remainingPending[0] };
  }

  static async rejectNode(nodeId, approverUser, comment) {
    const node = await this.findNodeById(nodeId);
    if (!node) throw new Error('审批节点不存在');
    
    const policyVersionId = node.policyVersionId;
    const allNodes = await ApprovalNode.findByPolicyVersionId(policyVersionId);
    
    const pendingNodes = allNodes.filter(n => n.status === ApprovalStatus.PENDING);
    const firstPendingNode = pendingNodes.length > 0 ? pendingNodes[0] : null;
    
    if (node.status !== ApprovalStatus.PENDING) {
      throw new Error('该节点无需驳回');
    }
    
    if (firstPendingNode && firstPendingNode.nodeOrder !== node.nodeOrder) {
      throw new Error(`审批必须按顺序进行，当前应审批节点：${firstPendingNode.nodeName}`);
    }
    
    await ApprovalNode.reject(nodeId, approverUser, comment);
    await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.REJECTED);
    
    return { policy: await PolicyVersion.findById(policyVersionId) };
  }

  static async publishPolicy(policyVersionId) {
    const policy = await PolicyVersion.findById(policyVersionId);
    if (!policy) throw new Error('制度不存在');
    if (policy.status !== PolicyStatus.APPROVED) throw new Error('只有审批通过的制度可以发布');
    
    await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.PUBLISHING);
    
    const channels = await PublishChannel.findByPolicyVersionId(policyVersionId);
    
    for (const channel of channels) {
      try {
        await PublishChannel.updateStatus(channel.id, ChannelStatus.PUBLISHING);
        await this.simulatePublish(channel);
        await PublishChannel.updateStatus(channel.id, ChannelStatus.SUCCESS);
      } catch (error) {
        await PublishChannel.updateStatus(channel.id, ChannelStatus.FAILED, error.message);
      }
    }
    
    const updatedChannels = await PublishChannel.findByPolicyVersionId(policyVersionId);
    const allSuccess = updatedChannels.every(c => c.status === ChannelStatus.SUCCESS);
    
    if (allSuccess) {
      await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.PUBLISHED);
    }
    
    return { policy: await PolicyVersion.findById(policyVersionId), channels: updatedChannels };
  }

  static async simulatePublish(channel) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (channel.channelName === '错误测试渠道') {
          reject(new Error('渠道连接失败: 模拟发布错误'));
        } else {
          resolve();
        }
      }, 500);
    });
  }

  static async findChannelById(channelId) {
    const policies = await PolicyVersion.findAll({});
    for (const p of policies) {
      const channels = await PublishChannel.findByPolicyVersionId(p.id);
      const channel = channels.find(c => c.id === channelId);
      if (channel) return channel;
    }
    return null;
  }

  static async retryPublish(channelId) {
    const channel = await this.findChannelById(channelId);
    if (!channel) throw new Error('发布渠道不存在');
    
    const policyVersionId = channel.policyVersionId;
    
    await PublishChannel.retry(channelId);
    
    try {
      await PublishChannel.updateStatus(channelId, ChannelStatus.PUBLISHING);
      await this.simulatePublish(channel);
      await PublishChannel.updateStatus(channelId, ChannelStatus.SUCCESS);
    } catch (error) {
      await PublishChannel.updateStatus(channelId, ChannelStatus.FAILED, error.message);
      throw error;
    }
    
    const updatedChannels = await PublishChannel.findByPolicyVersionId(policyVersionId);
    const allSuccess = updatedChannels.every(c => c.status === ChannelStatus.SUCCESS);
    
    if (allSuccess) {
      await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.PUBLISHED);
    }
    
    return { channel: updatedChannels.find(c => c.id === channelId) };
  }

  static async confirmReading(policyVersionId, userId, userName) {
    const policy = await PolicyVersion.findById(policyVersionId);
    if (!policy) throw new Error('制度不存在');
    if (policy.status !== PolicyStatus.PUBLISHED) throw new Error('只有已发布的制度可以确认阅读');
    
    const hasConfirmed = await ReadingConfirmation.hasConfirmed(policyVersionId, userId);
    if (hasConfirmed) throw new Error('该用户已确认阅读');
    
    return await ReadingConfirmation.create(policyVersionId, userId, userName);
  }

  static async abolishPolicy(policyVersionId, reason, abolishedBy) {
    const policy = await PolicyVersion.findById(policyVersionId);
    if (!policy) throw new Error('制度不存在');
    if (policy.status === PolicyStatus.ABOLISHED) throw new Error('该制度已废止');
    
    const references = await PolicyReference.findReferencesToPolicy(policy.policyCode);
    const activeReferences = references.filter(r => 
      r.referencingStatus === PolicyStatus.PUBLISHED || 
      r.referencingStatus === PolicyStatus.APPROVED ||
      r.referencingStatus === PolicyStatus.PUBLISHING ||
      r.referencingStatus === PolicyStatus.APPROVING
    );
    
    if (activeReferences.length > 0) {
      throw new Error(`存在 ${activeReferences.length} 个引用该制度的有效文档，请先处理引用`);
    }
    
    await AbolishRecord.create(policyVersionId, reason, abolishedBy);
    await PolicyVersion.updateStatus(policyVersionId, PolicyStatus.ABOLISHED);
    
    return { policy: await PolicyVersion.findById(policyVersionId) };
  }

  static async getPolicyDetail(policyVersionId) {
    const policy = await PolicyVersion.findById(policyVersionId);
    if (!policy) return null;
    
    const [approvalNodes, publishChannels, readingConfirmations, abolishRecords, references] = await Promise.all([
      ApprovalNode.findByPolicyVersionId(policyVersionId),
      PublishChannel.findByPolicyVersionId(policyVersionId),
      ReadingConfirmation.findByPolicyVersionId(policyVersionId),
      AbolishRecord.findByPolicyVersionId(policyVersionId),
      PolicyReference.findByPolicyVersionId(policyVersionId)
    ]);
    
    return {
      ...policy,
      approvalNodes,
      publishChannels,
      readingConfirmations,
      abolishRecords,
      references
    };
  }

  static async checkReferences(policyCode) {
    return await PolicyReference.findReferencesToPolicy(policyCode);
  }

  static async exportPolicies(filters = {}) {
    const policies = await PolicyVersion.findAll(filters);
    
    return policies.map(policy => ({
      制度编号: policy.policyCode,
      版本号: policy.versionNumber,
      标题: policy.title,
      状态: policy.status,
      创建人: policy.createdBy,
      创建时间: policy.createdAt
    }));
  }
}

module.exports = { PolicyService };
