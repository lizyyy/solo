import * as fs from 'fs-extra';
import * as path from 'path';
import csvParser from 'csv-parser';
import * as XLSX from 'xlsx';
import { Certificate, CertificateType, CertificateStatus, FieldMapping } from '../types';
import certificateRepository from '../database/repositories/certificateRepository';
import historyRepository from '../database/repositories/historyRepository';
import ownerRepository from '../database/repositories/ownerRepository';
import db from '../database/connection';
import { validateCertificateData, sanitizeString, normalizeDate } from '../utils/validators';
import { ImportError, ValidationError, formatErrorForUser } from '../utils/errors';

interface ImportOptions {
  source?: string;
  type?: string;
  mapping?: string;
  dryRun?: boolean;
}

interface RawRecord {
  [key: string]: any;
}

function detectFileType(filePath: string): 'csv' | 'xlsx' | 'json' {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.csv':
      return 'csv';
    case '.xlsx':
    case '.xls':
      return 'xlsx';
    case '.json':
      return 'json';
    default:
      throw new ImportError(`不支持的文件格式: ${ext}。支持的格式：CSV, Excel (.xlsx, .xls), JSON`);
  }
}

function getDefaultMapping(): FieldMapping {
  return {
    name: 'name',
    type: 'type',
    domain: 'domain',
    issuer: 'issuer',
    issueDate: 'issueDate',
    expiryDate: 'expiryDate',
    serialNumber: 'serialNumber',
    fingerprint: 'fingerprint',
    description: 'description',
    ownerName: 'ownerName',
    ownerEmail: 'ownerEmail',
    department: 'department'
  };
}

function applyMapping(record: RawRecord, mapping: FieldMapping): Partial<Certificate> {
  const cert: Partial<Certificate> = {};
  
  if (mapping.name && record[mapping.name]) {
    cert.name = sanitizeString(String(record[mapping.name]));
  }
  
  if (mapping.type && record[mapping.type]) {
    const typeValue = String(record[mapping.type]).toUpperCase();
    if (Object.values(CertificateType).includes(typeValue as CertificateType)) {
      cert.type = typeValue as CertificateType;
    }
  }
  
  if (mapping.domain && record[mapping.domain]) {
    cert.domain = sanitizeString(String(record[mapping.domain]));
  }
  
  if (mapping.issuer && record[mapping.issuer]) {
    cert.issuer = sanitizeString(String(record[mapping.issuer]));
  }
  
  if (mapping.issueDate && record[mapping.issueDate]) {
    cert.issueDate = normalizeDate(String(record[mapping.issueDate]));
  }
  
  if (mapping.expiryDate && record[mapping.expiryDate]) {
    cert.expiryDate = normalizeDate(String(record[mapping.expiryDate]));
  }
  
  if (mapping.serialNumber && record[mapping.serialNumber]) {
    cert.serialNumber = sanitizeString(String(record[mapping.serialNumber]));
  }
  
  if (mapping.fingerprint && record[mapping.fingerprint]) {
    cert.fingerprint = sanitizeString(String(record[mapping.fingerprint]));
  }
  
  if (mapping.description && record[mapping.description]) {
    cert.description = sanitizeString(String(record[mapping.description]));
  }
  
  if (mapping.ownerName && record[mapping.ownerName]) {
    cert.ownerName = sanitizeString(String(record[mapping.ownerName]));
  }
  
  if (mapping.ownerEmail && record[mapping.ownerEmail]) {
    cert.ownerEmail = sanitizeString(String(record[mapping.ownerEmail]));
  }
  
  if (mapping.department && record[mapping.department]) {
    cert.department = sanitizeString(String(record[mapping.department]));
  }
  
  return cert;
}

async function readCSV(filePath: string): Promise<RawRecord[]> {
  const records: RawRecord[] = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', (err) => reject(new ImportError('读取 CSV 文件失败', err)));
  });
}

async function readExcel(filePath: string): Promise<RawRecord[]> {
  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    return XLSX.utils.sheet_to_json(worksheet) as RawRecord[];
  } catch (error) {
    throw new ImportError('读取 Excel 文件失败', error);
  }
}

async function readJSON(filePath: string): Promise<RawRecord[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data;
    }
    if (data && typeof data === 'object') {
      return [data];
    }
    throw new ImportError('JSON 文件格式错误，应为对象或数组');
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ImportError('JSON 文件解析失败', error);
    }
    throw error;
  }
}

async function readFile(filePath: string): Promise<RawRecord[]> {
  const fileType = detectFileType(filePath);
  
  switch (fileType) {
    case 'csv':
      return readCSV(filePath);
    case 'xlsx':
      return readExcel(filePath);
    case 'json':
      return readJSON(filePath);
  }
}

function determineCertificateStatus(cert: Partial<Certificate>): CertificateStatus {
  const now = new Date();
  const expiryDate = cert.expiryDate ? new Date(cert.expiryDate) : null;
  
  if (!expiryDate) {
    return CertificateStatus.ACTIVE;
  }
  
  if (expiryDate < now) {
    return CertificateStatus.EXPIRED;
  }
  
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + 30);
  
  if (expiryDate <= warningDate) {
    return CertificateStatus.EXPIRING;
  }
  
  return CertificateStatus.ACTIVE;
}

export async function executeImport(filePath: string, options: ImportOptions): Promise<void> {
  console.log('\n📥 开始导入证书数据...\n');
  
  try {
    await db.init();
    
    if (!await fs.pathExists(filePath)) {
      throw new ImportError(`文件不存在: ${filePath}`);
    }
    
    const sourceName = options.source || 'manual';
    const defaultType = options.type ? options.type.toUpperCase() as CertificateType : CertificateType.SSL;
    
    console.log(`📂 源文件: ${filePath}`);
    console.log(`📦 来源标识: ${sourceName}`);
    console.log(`🔍 检测文件格式...`);
    
    const fileType = detectFileType(filePath);
    console.log(`✅ 文件格式: ${fileType.toUpperCase()}`);
    
    let mapping = getDefaultMapping();
    if (options.mapping) {
      try {
        mapping = JSON.parse(options.mapping) as FieldMapping;
        console.log(`✅ 使用自定义字段映射`);
      } catch (error) {
        throw new ImportError('字段映射 JSON 格式错误', error);
      }
    }
    
    console.log(`📖 读取数据...`);
    const records = await readFile(filePath);
    console.log(`✅ 读取到 ${records.length} 条记录\n`);
    
    if (records.length === 0) {
      console.log('⚠️  文件中没有数据');
      return;
    }
    
    const validCerts: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const invalidRecords: { record: RawRecord; errors: string[]; index: number }[] = [];
    
    records.forEach((record, index) => {
      const partialCert = applyMapping(record, mapping);
      
      if (!partialCert.type) {
        partialCert.type = defaultType;
      }
      
      const validation = validateCertificateData(partialCert);
      
      if (validation.valid) {
        const cert = partialCert as Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>;
        cert.source = sourceName;
        cert.sourceFile = path.basename(filePath);
        cert.status = determineCertificateStatus(partialCert);
        validCerts.push(cert);
      } else {
        invalidRecords.push({
          record,
          errors: validation.errors,
          index: index + 1
        });
      }
    });
    
    console.log(`📊 数据验证结果:`);
    console.log(`   ✅ 有效记录: ${validCerts.length}`);
    console.log(`   ❌ 无效记录: ${invalidRecords.length}\n`);
    
    if (invalidRecords.length > 0) {
      console.log('⚠️  无效记录详情:');
      invalidRecords.slice(0, 10).forEach(item => {
        console.log(`   第 ${item.index} 行: ${item.errors.join('; ')}`);
      });
      if (invalidRecords.length > 10) {
        console.log(`   ... 还有 ${invalidRecords.length - 10} 条无效记录`);
      }
      console.log('');
    }
    
    if (options.dryRun) {
      console.log('🔍 试运行模式，不实际导入数据\n');
      console.log(`📝 预计导入: ${validCerts.length} 条有效记录`);
      return;
    }
    
    if (validCerts.length === 0) {
      throw new ImportError('没有有效记录可导入');
    }
    
    console.log(`💾 开始导入 ${validCerts.length} 条记录...\n`);
    
    let imported = 0;
    let failed = 0;
    
    for (const cert of validCerts) {
      try {
        if (cert.ownerEmail && cert.ownerName) {
          try {
            await ownerRepository.findOrCreate({
              name: cert.ownerName,
              email: cert.ownerEmail,
              department: cert.department
            });
          } catch (e) {
            // 忽略责任人创建错误，继续导入证书
          }
        }
        
        const created = await certificateRepository.create(cert);
        await historyRepository.addRecord(
          created.id,
          'IMPORT',
          `从 ${sourceName} 导入证书`
        );
        imported++;
        
        if (imported % 10 === 0) {
          console.log(`   ⏳ 已导入 ${imported}/${validCerts.length} 条...`);
        }
      } catch (error) {
        failed++;
        console.error(`   ❌ 导入失败: ${cert.name} - ${(error as Error).message}`);
      }
    }
    
    console.log('\n✅ 导入完成！\n');
    console.log(`📊 导入统计:`);
    console.log(`   ✅ 成功导入: ${imported} 条`);
    console.log(`   ❌ 失败: ${failed} 条`);
    console.log(`   ⚠️  跳过(无效): ${invalidRecords.length} 条\n`);
    
    console.log('💡 下一步：');
    console.log('   1. 检查问题: cert-audit check');
    console.log('   2. 生成报告: cert-audit report\n');
    
  } catch (error) {
    console.error(formatErrorForUser(error));
    process.exit(1);
  }
}
