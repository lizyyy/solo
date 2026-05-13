import { ConstructionNode, InspectionPhoto } from '../models';

export async function canCompleteNode(nodeId: string): Promise<{ canComplete: boolean; reason: string }> {
  const node = await ConstructionNode.findByPk(nodeId);
  if (!node) {
    return { canComplete: false, reason: '施工节点不存在' };
  }

  if (node.isCompleted) {
    return { canComplete: false, reason: '该节点已完成' };
  }

  const previousNode = await ConstructionNode.findOne({
    where: {
      projectId: node.projectId,
      nodeOrder: node.nodeOrder - 1
    }
  });

  if (previousNode && !previousNode.isCompleted) {
    return { canComplete: false, reason: '前序节点未完成，无法进行当前节点' };
  }

  const photoCount = await InspectionPhoto.count({
    where: { nodeId: node.id, isInspectionPhoto: true }
  });

  if (photoCount === 0) {
    return { canComplete: false, reason: '请先上传验收照片' };
  }

  return { canComplete: true, reason: '' };
}

export async function completeNode(
  nodeId: string,
  completedBy: string,
  remarks?: string
): Promise<{ success: boolean; message: string; isCurrentNode: boolean; nextNodeId: string | null }> {
  const checkResult = await canCompleteNode(nodeId);
  if (!checkResult.canComplete) {
    return { success: false, message: checkResult.reason, isCurrentNode: false, nextNodeId: null };
  }

  const node = await ConstructionNode.findByPk(nodeId);
  if (!node) {
    return { success: false, message: '施工节点不存在', isCurrentNode: false, nextNodeId: null };
  }

  await node.update({
    isCompleted: true,
    completedTime: new Date(),
    completedBy,
    remarks: remarks || node.remarks
  });

  const nextNode = await ConstructionNode.findOne({
    where: {
      projectId: node.projectId,
      nodeOrder: node.nodeOrder + 1
    }
  });

  return {
    success: true,
    message: '节点完成成功',
    isCurrentNode: true,
    nextNodeId: nextNode?.id || null
  };
}
