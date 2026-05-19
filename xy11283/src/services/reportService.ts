import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import { getPrescriptionById, getPrescriptionItems } from './prescriptionService';
import { getMedicineById } from './inventoryService';
import { getDosageRulesByMedicineAndSpecies, calculateDosage } from './dosageService';
import { maskSensitiveData } from '../utils/security';

export async function generatePrescriptionPdf(
  prescriptionId: number,
  outputPath?: string
): Promise<string> {
  const prescription = await getPrescriptionById(prescriptionId);
  const items = await getPrescriptionItems(prescriptionId);

  const medicineDetails = await Promise.all(
    items.map(async (item) => {
      const medicine = await getMedicineById(item.medicine_id);
      const rules = await getDosageRulesByMedicineAndSpecies(item.medicine_id, prescription.species);
      const calcResult = calculateDosage(prescription.weight, prescription.weight_unit || 'kg', rules);
      return { medicine, calcResult };
    })
  );

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  const filename = outputPath || path.join(__dirname, '..', '..', 'data', `prescription_${prescription.prescription_no}.pdf`);
  const stream = createWriteStream(filename);
  doc.pipe(stream);

  doc.fontSize(20).text('宠物医院处方单', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`处方号: ${prescription.prescription_no}`);
  doc.text(`开具时间: ${new Date(prescription.issued_at).toLocaleString()}`);
  doc.text(`状态: ${getStatusText(prescription.status)}`);
  doc.moveDown();

  doc.fontSize(14).text('患者信息', { underline: true });
  doc.fontSize(12);
  doc.text(`姓名: ${prescription.patient_name}`);
  doc.text(`物种: ${prescription.species}`);
  if (prescription.breed) doc.text(`品种: ${prescription.breed}`);
  doc.text(`体重: ${prescription.weight} ${prescription.weight_unit || 'kg'}`);
  if (prescription.age) doc.text(`年龄: ${prescription.age}`);
  doc.moveDown();

  doc.fontSize(14).text('诊断', { underline: true });
  doc.fontSize(12).text(prescription.diagnosis || '未填写');
  doc.moveDown();

  doc.fontSize(14).text('处方明细', { underline: true });
  doc.moveDown(0.5);

  const tableTop = doc.y;
  const itemHeight = 20;
  const colWidths = [150, 80, 80, 120, 100];
  const headers = ['药品名称', '剂量', '数量', '用法', '备注'];

  doc.fontSize(10).font('Helvetica-Bold');
  let xPos = 50;
  headers.forEach((header, i) => {
    doc.text(header, xPos, tableTop);
    xPos += colWidths[i];
  });

  doc.font('Helvetica').fontSize(10);
  let yPos = tableTop + itemHeight;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const medicine = medicineDetails[i]?.medicine;
    const calcResult = medicineDetails[i]?.calcResult;

    xPos = 50;
    doc.text(medicine?.name || `药品 ${item.medicine_id}`, xPos, yPos);
    xPos += colWidths[0];

    doc.text(`${item.dosage} ${item.dosage_unit}`, xPos, yPos);
    xPos += colWidths[1];

    doc.text(`${item.quantity} ${item.quantity_unit}`, xPos, yPos);
    xPos += colWidths[2];

    const usage = [];
    if (item.route) usage.push(item.route);
    if (item.frequency) usage.push(item.frequency);
    if (item.days) usage.push(`共${item.days}天`);
    doc.text(usage.join(' ') || '-', xPos, yPos);
    xPos += colWidths[3];

    doc.text(item.notes || '-', xPos, yPos);

    yPos += itemHeight;

    if (item.dosage_warning) {
      doc.fontSize(9).fillColor('red');
      doc.text(`⚠ ${item.dosage_warning}`, 60, yPos);
      doc.fillColor('black').fontSize(10);
      yPos += itemHeight;
    }

    if (calcResult?.calculatedDosage) {
      doc.fontSize(9).fillColor('blue');
      doc.text(`推荐剂量: ${calcResult.calculatedDosage} ${calcResult.rule?.dosage_unit || item.dosage_unit}`, 60, yPos);
      doc.fillColor('black').fontSize(10);
      yPos += itemHeight;
    }
  }

  doc.y = yPos + 10;
  doc.moveDown();

  doc.fontSize(14).text('医生信息', { underline: true });
  doc.fontSize(12);
  doc.text(`医生: ${prescription.doctor_name}`);
  doc.moveDown(2);

  doc.fontSize(10).text('___________________', 400, doc.y);
  doc.text('医生签名', 420, doc.y + 15);

  doc.end();

  return new Promise((resolve, reject) => {
    stream.on('finish', () => resolve(filename));
    stream.on('error', reject);
  });
}

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待审核',
    'validated': '已审核',
    'dispensed': '已发药',
    'cancelled': '已取消'
  };
  return statusMap[status] || status;
}

export async function generateDosageReport(
  medicineId: number,
  species: string,
  weightRange: { min: number; max: number; step: number }
): Promise<any> {
  const medicine = await getMedicineById(medicineId);
  const rules = await getDosageRulesByMedicineAndSpecies(medicineId, species);

  const results: any[] = [];

  for (let weight = weightRange.min; weight <= weightRange.max; weight += weightRange.step) {
    const calcResult = calculateDosage(weight, 'kg', rules);
    results.push({
      weight,
      valid: calcResult.valid,
      calculatedDosage: calcResult.calculatedDosage,
      warning: calcResult.warning,
      error: calcResult.error
    });
  }

  return {
    medicine: maskSensitiveData(medicine),
    species,
    results
  };
}

export function exportToCsv(data: any[], filename: string): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const val = row[h];
        if (typeof val === 'string' && (val.includes(',') || val.includes('\n'))) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val ?? '';
      }).join(',')
    )
  ];

  const csvContent = csvRows.join('\n');
  const outputPath = path.join(__dirname, '..', '..', 'data', filename);
  require('fs').writeFileSync(outputPath, csvContent, 'utf-8');
  return outputPath;
}
