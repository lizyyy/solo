import * as fs from 'fs';
import csvParser from 'csv-parser';
import { HealthCheckRecord, Student, MedicationAuthorization } from '../types';
import { generateId } from '../utils/date';

export class DataImportService {
  async importHealthCheckCSV(filePath: string): Promise<HealthCheckRecord[]> {
    const records: HealthCheckRecord[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row: any) => {
          const record = this.parseHealthCheckRow(row);
          if (record) {
            records.push(record);
          }
        })
        .on('end', () => resolve(records))
        .on('error', reject);
    });
  }

  private parseHealthCheckRow(row: any): HealthCheckRecord | null {
    try {
      const symptoms = row.symptoms ? row.symptoms.split('、').filter(Boolean) : [];
      return {
        id: generateId(),
        studentId: row.studentId || row['学号'],
        studentName: row.studentName || row['姓名'],
        checkDate: row.checkDate || row['日期'],
        temperature: parseFloat(row.temperature || row['体温']),
        hasSymptoms: (row.hasSymptoms || row['有症状']) === '是' || row.hasSymptoms === 'true',
        symptoms,
        isIsolated: (row.isIsolated || row['已隔离']) === '是' || row.isIsolated === 'true',
        checker: row.checker || row['检查人'],
        notes: row.notes || row['备注'],
        source: 'csv',
      };
    } catch (e) {
      console.error('解析晨检记录失败:', row, e);
      return null;
    }
  }

  async importMedicationJSON(filePath: string): Promise<MedicationAuthorization[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.map((item: any) => ({
      id: generateId(),
      studentId: item.studentId,
      studentName: item.studentName,
      medicationName: item.medicationName,
      category: item.category,
      dosage: item.dosage,
      frequency: item.frequency,
      expirationDate: item.expirationDate,
      parentConfirmed: item.parentConfirmed,
      confirmedDate: item.confirmedDate,
      authorizedBy: item.authorizedBy,
      effectiveDate: item.effectiveDate,
      expiryDate: item.expiryDate,
    }));
  }

  async importClassListCSV(filePath: string): Promise<Student[]> {
    const students: Student[] = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (row: any) => {
          const student = this.parseStudentRow(row);
          if (student) {
            students.push(student);
          }
        })
        .on('end', () => resolve(students))
        .on('error', reject);
    });
  }

  private parseStudentRow(row: any): Student | null {
    try {
      return {
        id: generateId(),
        studentId: row.studentId || row['学号'],
        name: row.name || row['姓名'],
        className: row.className || row['班级'],
        grade: row.grade || row['年级'],
        parentPhone: row.parentPhone || row['家长电话'],
      };
    } catch (e) {
      console.error('解析学生记录失败:', row, e);
      return null;
    }
  }

  validateHealthCheckRecords(records: HealthCheckRecord[]): { valid: HealthCheckRecord[]; invalid: any[] } {
    const valid: HealthCheckRecord[] = [];
    const invalid: any[] = [];

    records.forEach((record) => {
      const errors: string[] = [];
      if (!record.studentId) errors.push('缺少学号');
      if (!record.checkDate) errors.push('缺少日期');
      if (isNaN(record.temperature)) errors.push('体温无效');
      if (record.temperature < 35 || record.temperature > 42) errors.push('体温超出正常范围');

      if (errors.length > 0) {
        invalid.push({ record, errors });
      } else {
        valid.push(record);
      }
    });

    return { valid, invalid };
  }

  validateMedicationAuthorizations(auths: MedicationAuthorization[]): { valid: MedicationAuthorization[]; invalid: any[] } {
    const valid: MedicationAuthorization[] = [];
    const invalid: any[] = [];

    auths.forEach((auth) => {
      const errors: string[] = [];
      if (!auth.studentId) errors.push('缺少学号');
      if (!auth.medicationName) errors.push('缺少药品名称');
      if (!auth.expiryDate) errors.push('缺少有效期');

      if (errors.length > 0) {
        invalid.push({ auth, errors });
      } else {
        valid.push(auth);
      }
    });

    return { valid, invalid };
  }
}