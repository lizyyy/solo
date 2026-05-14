import fs from 'fs/promises';
import path from 'path';

const SAMPLE_TYPES = ['血液', '尿液', '唾液', '组织', '脑脊液'];
const TEST_ITEMS = ['血常规', '生化全套', '免疫检测', 'PCR检测', '药敏试验'];
const DEPARTMENTS = ['内科', '外科', '儿科', '妇产科', '急诊科'];
const OPERATORS = ['张医生', '李护士', '王技师', '陈主任', '刘检验师'];
const RISK_TYPES = ['正常', '低风险', '中风险', '高风险'];

function generateBusinessNo() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `LAB${dateStr}${seq}`;
}

function generateSampleData(options = {}) {
  const {
    batchId = `BATCH${Date.now()}`,
    recordCount = 50,
    includeDirtyRows = true,
    operator = OPERATORS[Math.floor(Math.random() * OPERATORS.length)]
  } = options;

  const samples = [];
  const rawInputs = [];
  
  for (let i = 0; i < recordCount; i++) {
    const businessNo = generateBusinessNo();
    const sampleType = SAMPLE_TYPES[Math.floor(Math.random() * SAMPLE_TYPES.length)];
    const testItem = TEST_ITEMS[Math.floor(Math.random() * TEST_ITEMS.length)];
    const department = DEPARTMENTS[Math.floor(Math.random() * DEPARTMENTS.length)];
    const riskType = RISK_TYPES[Math.floor(Math.random() * RISK_TYPES.length)];
    const patientAge = Math.floor(Math.random() * 80) + 1;
    const patientGender = Math.random() > 0.5 ? '男' : '女';
    
    const sample = {
      businessNo,
      batchId,
      sampleId: `S${String(i + 1).padStart(6, '0')}`,
      sampleType,
      testItem,
      department,
      patientName: `患者${i + 1}`,
      patientAge,
      patientGender,
      collector: operator,
      collectTime: new Date(Date.now() - Math.random() * 86400000 * 7).toISOString(),
      receiveTime: new Date(Date.now() - Math.random() * 86400000 * 3).toISOString(),
      riskType,
      status: '待检测',
      rawInputIndex: i,
      createdAt: new Date().toISOString()
    };
    
    samples.push(sample);
    
    const rawInput = {
      index: i,
      businessNo,
      originalLine: `${businessNo},${sample.sampleId},${sample.patientName},${patientAge},${patientGender},${sampleType},${testItem},${department},${operator},${sample.collectTime}`,
      parsedFields: {
        businessNo,
        sampleId: sample.sampleId,
        patientName: sample.patientName,
        patientAge,
        patientGender,
        sampleType,
        testItem,
        department,
        collector: operator,
        collectTime: sample.collectTime
      }
    };
    rawInputs.push(rawInput);
  }
  
  if (includeDirtyRows) {
    const dirtyRowIndex = Math.floor(recordCount / 2);
    
    const swallowedDirtyRow = {
      index: recordCount,
      businessNo: generateBusinessNo(),
      originalLine: '',
      parsedFields: null,
      isDirty: true,
      dirtyType: 'swallowed',
      errorMessage: '该行数据格式异常，字段缺失严重，被系统自动过滤',
      rawContent: 'LAB202605150099,S000051,异常患者,,男,,,张医生,2026-05-15T08:30:00.000Z',
      missingFields: ['sampleType', 'testItem', 'department', 'patientAge'],
      detectedAt: new Date().toISOString()
    };
    rawInputs.splice(dirtyRowIndex, 0, swallowedDirtyRow);
    
    const malformedRow = {
      index: recordCount + 1,
      businessNo: generateBusinessNo(),
      originalLine: 'LAB202605150100,S000052,测试不完整,30,男,血液,血常规',
      parsedFields: {
        businessNo: 'LAB202605150100',
        sampleId: 'S000052',
        patientName: '测试不完整',
        patientAge: 30,
        patientGender: '男',
        sampleType: '血液',
        testItem: '血常规'
      },
      isDirty: true,
      dirtyType: 'malformed',
      errorMessage: '字段数量不匹配，后续字段截断',
      rawContent: 'LAB202605150100,S000052,测试不完整,30,男,血液,血常规',
      missingFields: ['department', 'collector', 'collectTime'],
      detectedAt: new Date().toISOString()
    };
    rawInputs.push(malformedRow);
  }
  
  return {
    batchId,
    operator,
    generatedAt: new Date().toISOString(),
    totalRecords: samples.length,
    dirtyRecords: rawInputs.filter(r => r.isDirty).length,
    samples,
    rawInputs
  };
}

async function saveGeneratedData(data, filePath) {
  const fullPath = path.resolve(filePath);
  await fs.writeFile(fullPath, JSON.stringify(data, null, 2), 'utf8');
  return fullPath;
}

async function loadGeneratedData(filePath) {
  const fullPath = path.resolve(filePath);
  const content = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(content);
}

export {
  generateSampleData,
  saveGeneratedData,
  loadGeneratedData,
  SAMPLE_TYPES,
  TEST_ITEMS,
  DEPARTMENTS,
  OPERATORS,
  RISK_TYPES
};
