import { LaboratorySample } from './types';
import * as crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

const sampleNames = [
  '血清样本', '全血样本', '尿液样本', '唾液样本', '脑脊液样本',
  '组织活检样本', '痰液样本', '粪便样本', '骨髓样本', '胸水样本'
];

const sampleTypes = ['常规', '加急', '特急', '科研'];

const submitters = ['张三', '李四', '王五', '赵六', '钱七', '孙八'];

const laboratories = ['中心实验室', '第一分院实验室', '第二分院实验室', '第三方检测中心', '外部合作实验室'];

const testItemsList = [
  ['血常规', '生化全套', '电解质'],
  ['肝功能', '肾功能', '血糖', '血脂'],
  ['肿瘤标志物', '甲状腺功能', '激素六项'],
  ['新冠核酸', '流感检测', '呼吸道病原体'],
  ['细菌培养', '药敏试验', '真菌检测'],
  ['尿常规', '尿微量蛋白', '尿沉渣'],
  ['凝血功能', 'D-二聚体', '血小板聚集'],
  ['免疫球蛋白', '补体', '自身抗体'],
  ['糖化血红蛋白', '胰岛素', 'C肽'],
  ['心肌酶谱', '肌钙蛋白', 'BNP']
];

export function generateLaboratorySamples(batchId: string, count: number = 10): LaboratorySample[] {
  const samples: LaboratorySample[] = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const sampleNo = `LAB-${formatDate(today)}-${String(1000 + i).padStart(4, '0')}`;
    const collectionDate = new Date(today);
    collectionDate.setDate(today.getDate() - Math.floor(Math.random() * 60));
    
    const sample: LaboratorySample = {
      id: generateId(),
      sampleNo,
      sampleName: sampleNames[Math.floor(Math.random() * sampleNames.length)],
      sampleType: sampleTypes[Math.floor(Math.random() * sampleTypes.length)],
      collectionTime: collectionDate.toISOString(),
      submitter: submitters[Math.floor(Math.random() * submitters.length)],
      laboratory: laboratories[Math.floor(Math.random() * laboratories.length)],
      testItems: testItemsList[Math.floor(Math.random() * testItemsList.length)],
      status: 'pending',
      submitTime: new Date().toISOString(),
      batchId
    };
    
    samples.push(sample);
  }
  
  const duplicateIndex = Math.floor(Math.random() * samples.length);
  const duplicateSample: LaboratorySample = {
    ...samples[duplicateIndex],
    id: generateId(),
    submitTime: new Date(Date.now() + 5000).toISOString()
  };
  samples.push(duplicateSample);
  
  const gatewayErrorIndex = Math.floor(Math.random() * samples.length);
  samples[gatewayErrorIndex].gatewayError = '504 Gateway Timeout - 上游服务响应超时，请检查网络连接';
  samples[gatewayErrorIndex].status = 'failed';
  
  const invalidFormatIndex = Math.floor(Math.random() * samples.length);
  samples[invalidFormatIndex].sampleNo = `INVALID-${Math.random().toString(36).substr(2, 9)}`;
  
  return samples;
}

export function generateSingleSample(batchId: string, overrides: Partial<LaboratorySample> = {}): LaboratorySample {
  const today = new Date();
  const collectionDate = new Date(today);
  collectionDate.setDate(today.getDate() - Math.floor(Math.random() * 30));
  
  return {
    id: overrides.id || generateId(),
    sampleNo: overrides.sampleNo || `LAB-${formatDate(today)}-${String(1000 + Math.floor(Math.random() * 9000)).padStart(4, '0')}`,
    sampleName: overrides.sampleName || sampleNames[Math.floor(Math.random() * sampleNames.length)],
    sampleType: overrides.sampleType || sampleTypes[Math.floor(Math.random() * sampleTypes.length)],
    collectionTime: overrides.collectionTime || collectionDate.toISOString(),
    submitter: overrides.submitter || submitters[Math.floor(Math.random() * submitters.length)],
    laboratory: overrides.laboratory || laboratories[Math.floor(Math.random() * laboratories.length)],
    testItems: overrides.testItems || testItemsList[Math.floor(Math.random() * testItemsList.length)],
    status: overrides.status || 'pending',
    gatewayError: overrides.gatewayError,
    submitTime: overrides.submitTime || new Date().toISOString(),
    batchId
  };
}
