import * as reviewService from './services/reviewService';

const now = Date.now();

const seed = async () => {
  const operatorId = 'admin_001';
  const operatorName = '系统管理员';

  const baseTime = now - 86400000 * 3;

  const fullFlowFragment = await reviewService.createFragment(
    {
      roomId: 'room_610528',
      roomName: '王者荣耀官方赛事',
      anchorName: 'KPL解说李九',
      fragmentStartTime: baseTime + 3600000,
      fragmentEndTime: baseTime + 3605000,
      violationTag: '违规吸烟',
      violationDescription: '直播画面中出现吸烟动作，持续约5秒',
      detectModel: 'vision-smoke-v2.1',
      confidence: 0.94,
    },
    operatorId,
    operatorName,
    'system'
  );

  await reviewService.updateStatus(
    fullFlowFragment.id,
    'confirmed',
    'reviewer_001',
    '张审核',
    'manual',
    '经人工复核，确认存在吸烟违规行为'
  );

  await reviewService.updateStatus(
    fullFlowFragment.id,
    'archived',
    'reviewer_001',
    '张审核',
    'batch',
    '已完成处罚流程，归档记录'
  );

  const conflictFragment1 = await reviewService.createFragment(
    {
      roomId: 'room_998877',
      roomName: '深夜情感电台',
      anchorName: '主播小雅',
      fragmentStartTime: baseTime + 7200000,
      fragmentEndTime: baseTime + 7210000,
      violationTag: '低俗言论',
      violationDescription: '检测到疑似低俗用语',
      detectModel: 'nlp-audit-v3.0',
      confidence: 0.87,
    },
    operatorId,
    operatorName,
    'system'
  );

  const conflictFragment2 = await reviewService.createFragment(
    {
      roomId: 'room_998877',
      roomName: '深夜情感电台',
      anchorName: '主播小雅',
      fragmentStartTime: baseTime + 7203000,
      fragmentEndTime: baseTime + 7212000,
      violationTag: '敏感话题',
      violationDescription: '检测到敏感话题讨论',
      detectModel: 'content-filter-v1.5',
      confidence: 0.79,
    },
    operatorId,
    operatorName,
    'system'
  );

  const importRecords = [
    {
      roomId: 'room_123456',
      roomName: '户外探险直播',
      anchorName: '户外阿强',
      fragmentStartTime: baseTime + 10800000,
      fragmentEndTime: baseTime + 10808000,
      violationTag: '危险行为',
      violationDescription: '无保护高空作业',
      detectModel: 'danger-detect-v2.0',
      confidence: 0.91,
    },
    {
      roomId: '',
      roomName: '',
      anchorName: '',
      fragmentStartTime: 0,
      fragmentEndTime: 0,
      violationTag: '',
      detectModel: '',
      confidence: 0,
    },
    {
      roomId: 'room_789012',
      roomName: '美食测评',
      anchorName: '吃货老王',
      fragmentStartTime: baseTime + 10800000,
      fragmentEndTime: baseTime + 10800000 - 1000,
      violationTag: '广告违规',
      detectModel: 'ad-detect-v1.0',
      confidence: 0.85,
    },
  ];

  const importResult = await reviewService.batchImport(importRecords, operatorId, operatorName);

  return {
    fullFlowFragment,
    conflictFragments: [conflictFragment1, conflictFragment2],
    importResult,
  };
};

export default seed;
