import './database';
import * as taskService from './services/taskService';

const demoFragments = [
  { speaker: '发言人A', start_time: 0, end_time: 5.2, content: '大家好，今天我们来讨论一下产品的新功能。', confidence: 0.95 },
  { speaker: '发言人B', start_time: 6.1, end_time: 12.3, content: '好的，我先介绍一下这次的技术方案。', confidence: 0.92 },
  { speaker: '发言人A', start_time: 13.5, end_time: 18.7, content: '这个方案的性能指标如何？', confidence: 0.94 },
  { speaker: '发言人B', start_time: 19.2, end_time: 25.8, content: '我们做了压力测试，QPS可以达到1000以上。', confidence: 0.91 },
  { speaker: '发言人C', start_time: 26.5, end_time: 32.1, content: '安全性方面有什么保障措施？', confidence: 0.93 },
  { speaker: '发言人B', start_time: 33.0, end_time: 40.5, content: '我们使用了JWT认证，接口都有权限校验，数据也做了加密存储。', confidence: 0.90 }
];

const seedDemoData = async () => {
  console.log('开始生成演示数据...');

  const task1 = await taskService.createTask({
    audio_url: 'https://example.com/audio/meeting1.mp3',
    audio_duration: 3600,
    file_name: '产品周会_20240515.mp3',
    callback_url: 'https://api.example.com/callback/transcription',
    secret_key: 'demo_secret_key_123'
  });

  await taskService.updateTaskStatus(task1.id, 'transcribing', 'system', '开始转写');
  await taskService.advanceStage(task1.id);
  await taskService.completeStage(task1.id, 'audio_analysis');
  await taskService.advanceStage(task1.id);
  await taskService.completeStage(task1.id, 'speech_recognition');
  await taskService.advanceStage(task1.id);
  await taskService.completeStage(task1.id, 'text_processing');
  await taskService.saveTextFragments(task1.id, demoFragments);
  await taskService.updateTaskStatus(task1.id, 'transcribed', 'system', '转写完成');
  await taskService.updateTaskStatus(task1.id, 'callback_pending', 'system', '等待回调');
  await taskService.executeCallback(task1.id);

  const task2 = await taskService.createTask({
    audio_url: 'https://example.com/audio/interview.mp3',
    audio_duration: 1800,
    file_name: '技术面试_张三.mp3',
    callback_url: 'https://hr.example.com/webhook',
    secret_key: 'hr_secret_456'
  });

  await taskService.updateTaskStatus(task2.id, 'transcribing', 'system', '开始转写');
  await taskService.advanceStage(task2.id);
  await taskService.completeStage(task2.id, 'audio_analysis');
  await taskService.advanceStage(task2.id);

  const task3 = await taskService.createTask({
    audio_url: 'https://example.com/audio/call.mp3',
    audio_duration: 600,
    file_name: '客服通话记录_001.mp3',
    callback_url: 'https://crm.example.com/api/callback',
    secret_key: 'crm_secret_789'
  });

  await taskService.updateTaskStatus(task3.id, 'transcribing', 'system', '开始转写');
  await taskService.advanceStage(task3.id);
  await taskService.completeStage(task3.id, 'audio_analysis');
  await taskService.advanceStage(task3.id);
  await taskService.completeStage(task3.id, 'speech_recognition');
  await taskService.advanceStage(task3.id);
  await taskService.completeStage(task3.id, 'text_processing');
  await taskService.saveTextFragments(task3.id, [
    { speaker: '客服', start_time: 0, end_time: 8, content: '您好，请问有什么可以帮您？', confidence: 0.96 },
    { speaker: '客户', start_time: 9, end_time: 15, content: '我想查询一下我的订单状态。', confidence: 0.94 }
  ]);
  await taskService.updateTaskStatus(task3.id, 'transcribed', 'system', '转写完成');
  await taskService.updateTaskStatus(task3.id, 'callback_pending', 'system', '等待回调');
  await taskService.executeCallback(task3.id);

  console.log('演示数据生成完成！');
  console.log('任务1 (回调失败):', task1.id);
  console.log('任务2 (转写中):', task2.id);
  console.log('任务3 (回调失败):', task3.id);
  
  process.exit(0);
};

seedDemoData().catch(console.error);
