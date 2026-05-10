import express from 'express';
import db from '../database';
import recoveryTaskService from '../services/recoveryTaskService';
import { successResponse, errorResponse, formatBusinessTime, taskStatusDesc } from '../utils/business';
import { TaskStatus } from '../types';

const router = express.Router();

router.post('/', (req, res) => {
  const { storeId, itemId, channelIds, scheduledTime, reason, createdBy } = req.body;
  
  if (!storeId || !itemId || !channelIds || !scheduledTime) {
    return res.status(400).json(errorResponse('ERR-API-001', '缺少必填参数：storeId、itemId、channelIds、scheduledTime'));
  }

  const result = recoveryTaskService.createTask(
    storeId,
    itemId,
    Array.isArray(channelIds) ? channelIds : [channelIds],
    scheduledTime,
    reason || '库存恢复自动上架',
    createdBy || 'API调用者'
  );
  
  res.json(result);
});

router.get('/', (req, res) => {
  const { storeId, status } = req.query as { storeId?: string; status?: string };
  
  const tasks = recoveryTaskService.getAllTasks(
    storeId,
    status as TaskStatus | undefined
  );
  
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));
  const channelMap = new Map(db.channels.map(c => [c.id, c.name]));

  const formatted = tasks.map(t => ({
    任务ID: t.id,
    门店ID: t.storeId,
    商品ID: t.itemId,
    商品名称: itemMap.get(t.itemId) || t.itemId,
    恢复渠道: t.channelIds.map(id => channelMap.get(id) || id).join('、'),
    计划执行时间: formatBusinessTime(t.scheduledTime),
    任务状态: taskStatusDesc[t.status],
    实际执行时间: t.executedAt ? formatBusinessTime(t.executedAt) : '-',
    任务原因: t.reason,
    创建人: t.createdBy,
    创建时间: formatBusinessTime(t.createdAt)
  }));

  res.json(successResponse(
    `获取恢复任务列表成功，共${formatted.length}个任务`,
    formatted
  ));
});

router.get('/pending', (req, res) => {
  const { storeId, itemId } = req.query as { storeId?: string; itemId?: string };
  
  const tasks = recoveryTaskService.getPendingTasks(storeId, itemId);
  
  const itemMap = new Map(db.menuItems.map(i => [i.id, i.name]));
  const channelMap = new Map(db.channels.map(c => [c.id, c.name]));

  const formatted = tasks.map(t => ({
    任务ID: t.id,
    门店ID: t.storeId,
    商品名称: itemMap.get(t.itemId) || t.itemId,
    恢复渠道: t.channelIds.map(id => channelMap.get(id) || id).join('、'),
    计划执行时间: formatBusinessTime(t.scheduledTime),
    任务原因: t.reason
  }));

  res.json(successResponse(
    `获取待执行恢复任务成功，共${formatted.length}个任务`,
    formatted
  ));
});

router.post('/:taskId/execute', (req, res) => {
  const { taskId } = req.params;
  const result = recoveryTaskService.executeTask(taskId);
  res.json(result);
});

router.post('/:taskId/cancel', (req, res) => {
  const { taskId } = req.params;
  const { operator } = req.body;
  
  const result = recoveryTaskService.cancelTask(
    taskId,
    operator || 'API调用者'
  );
  
  res.json(result);
});

router.post('/execute-due', (req, res) => {
  const result = recoveryTaskService.executeDueTasks();
  res.json(result);
});

export default router;
