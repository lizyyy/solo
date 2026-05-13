import { ConstructionNode, Project } from '../models';
import { Op } from 'sequelize';

export async function processDeduction(
  nodeId: string,
  requestId: string,
  amount: number,
  processedBy: string
): Promise<{ success: boolean; message: string; alreadyProcessed: boolean }> {
  const node = await ConstructionNode.findByPk(nodeId);
  if (!node) {
    return { success: false, message: '施工节点不存在', alreadyProcessed: false };
  }

  if (node.isDeducted) {
    return { success: false, message: '该节点已完成扣减', alreadyProcessed: true };
  }

  const existingRequest = await ConstructionNode.findOne({
    where: {
      deductionRequestId: requestId,
      id: { [Op.ne]: nodeId }
    }
  });

  if (existingRequest) {
    return { success: false, message: '该请求ID已被其他节点使用', alreadyProcessed: true };
  }

  await node.update({
    isDeducted: true,
    deductedTime: new Date(),
    deductedBy: processedBy,
    deductionRequestId: requestId,
    deductionAmount: amount
  });

  const project = await Project.findByPk(node.projectId);
  if (project) {
    const newActualAmount = (project.actualAmount || 0) + amount;
    await project.update({ actualAmount: newActualAmount });
  }

  return { success: true, message: '扣减成功', alreadyProcessed: false };
}

export async function checkDeductionStatus(requestId: string): Promise<{ exists: boolean; nodeId: string | null }> {
  const node = await ConstructionNode.findOne({
    where: { deductionRequestId: requestId }
  });

  return {
    exists: !!node,
    nodeId: node?.id || null
  };
}
