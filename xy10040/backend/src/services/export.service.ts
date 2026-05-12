import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Event, Registration, ExportFormat } from '../types';
import { eventService } from './event.service';
import { registrationService } from './registration.service';
import { NotFoundError } from '../utils/errors';

export interface ExportOptions {
  format: ExportFormat;
  includeCancelled?: boolean;
}

export class ExportService {
  async exportEvent(
    eventId: string,
    options: ExportOptions
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const event = await eventService.findById(eventId);
    if (!event) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    const registrations = await this.getAllRegistrations(eventId, options);

    switch (options.format) {
      case 'excel':
        return this.exportToExcel(event, registrations);
      case 'pdf':
        return this.exportToPDF(event, registrations);
      case 'markdown':
        return this.exportToMarkdown(event, registrations);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  private async getAllRegistrations(
    eventId: string,
    options: ExportOptions
  ): Promise<Registration[]> {
    const allRegistrations: Registration[] = [];
    let page = 1;
    const pageSize = 100;

    while (true) {
      const result = await registrationService.findByEvent(eventId, {
        page,
        pageSize,
        ...(options.includeCancelled ? {} : { status: 'confirmed' }),
      });

      allRegistrations.push(...result.items);

      if (!result.hasMore) {
        break;
      }

      page++;
    }

    return allRegistrations;
  }

  private async exportToExcel(
    event: Event,
    registrations: Registration[]
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Event Summary');
    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 25 },
      { header: 'Value', key: 'value', width: 50 },
    ];

    summarySheet.addRows([
      { field: 'Event Title', value: event.title },
      { field: 'Description', value: event.description || '-' },
      { field: 'Start Time', value: event.startTime.toLocaleString() },
      { field: 'End Time', value: event.endTime.toLocaleString() },
      { field: 'Max Participants', value: event.maxParticipants },
      { field: 'Current Participants', value: event.currentParticipants },
      { field: 'Status', value: event.status },
      { field: 'Total Registrations', value: registrations.length },
    ]);

    const registrationsSheet = workbook.addWorksheet('Registrations');
    registrationsSheet.columns = [
      { header: '#', key: 'index', width: 5 },
      { header: 'Name', key: 'userName', width: 20 },
      { header: 'Email', key: 'userEmail', width: 30 },
      { header: 'Phone', key: 'userPhone', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Notes', key: 'notes', width: 30 },
      { header: 'Registered At', key: 'createdAt', width: 20 },
    ];

    registrations.forEach((reg, index) => {
      registrationsSheet.addRow({
        index: index + 1,
        userName: reg.userName,
        userEmail: reg.userEmail,
        userPhone: reg.userPhone || '-',
        status: reg.status,
        notes: reg.notes || '-',
        createdAt: reg.createdAt.toLocaleString(),
      });
    });

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer() as ArrayBuffer);

    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${event.title}_registrations_${new Date().toISOString().split('T')[0]}.xlsx`,
    };
  }

  private async exportToMarkdown(
    event: Event,
    registrations: Registration[]
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const confirmed = registrations.filter((r) => r.status === 'confirmed');
    const cancelled = registrations.filter((r) => r.status === 'cancelled');

    let markdown = `# ${event.title}\n\n`;
    markdown += `## Event Details\n\n`;
    markdown += `- **Start Time:** ${event.startTime.toLocaleString()}\n`;
    markdown += `- **End Time:** ${event.endTime.toLocaleString()}\n`;
    markdown += `- **Max Participants:** ${event.maxParticipants}\n`;
    markdown += `- **Current Participants:** ${event.currentParticipants}\n`;
    markdown += `- **Status:** ${event.status}\n\n`;

    if (event.description) {
      markdown += `## Description\n\n${event.description}\n\n`;
    }

    markdown += `## Registration Statistics\n\n`;
    markdown += `- **Total:** ${registrations.length}\n`;
    markdown += `- **Confirmed:** ${confirmed.length}\n`;
    markdown += `- **Cancelled:** ${cancelled.length}\n\n`;

    markdown += `## Confirmed Registrations\n\n`;
    markdown += `| # | Name | Email | Phone | Notes |\n`;
    markdown += `|---|------|-------|-------|-------|\n`;

    confirmed.forEach((reg, index) => {
      markdown += `| ${index + 1} | ${reg.userName} | ${reg.userEmail} | ${reg.userPhone || '-'} | ${reg.notes || '-'} |\n`;
    });

    if (cancelled.length > 0) {
      markdown += `\n## Cancelled Registrations\n\n`;
      markdown += `| # | Name | Email | Cancelled At |\n`;
      markdown += `|---|------|-------|--------------|\n`;

      cancelled.forEach((reg, index) => {
        markdown += `| ${index + 1} | ${reg.userName} | ${reg.userEmail} | ${reg.updatedAt.toLocaleString()} |\n`;
      });
    }

    markdown += `\n---\n\n`;
    markdown += `*Generated at: ${new Date().toLocaleString()}*\n`;

    return {
      buffer: Buffer.from(markdown, 'utf-8'),
      contentType: 'text/markdown',
      filename: `${event.title}_registrations_${new Date().toISOString().split('T')[0]}.md`,
    };
  }

  private async exportToPDF(
    event: Event,
    registrations: Registration[]
  ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          buffer,
          contentType: 'application/pdf',
          filename: `${event.title}_registrations_${new Date().toISOString().split('T')[0]}.pdf`,
        });
      });
      doc.on('error', reject);

      doc.fontSize(24).text(event.title, { align: 'center' });
      doc.moveDown(2);

      doc.fontSize(14).text('Event Details', { underline: true });
      doc.moveDown(0.5);
      doc.fontSize(12);
      doc.text(`Start: ${event.startTime.toLocaleString()}`);
      doc.text(`End: ${event.endTime.toLocaleString()}`);
      doc.text(`Participants: ${event.currentParticipants}/${event.maxParticipants}`);
      doc.text(`Status: ${event.status}`);
      doc.moveDown(2);

      if (event.description) {
        doc.fontSize(14).text('Description', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12).text(event.description);
        doc.moveDown(2);
      }

      doc.fontSize(14).text('Registrations', { underline: true });
      doc.moveDown(0.5);

      const confirmed = registrations.filter((r) => r.status === 'confirmed');

      doc.fontSize(12);
      doc.text(`Total: ${registrations.length} | Confirmed: ${confirmed.length}`);
      doc.moveDown(1);

      confirmed.forEach((reg, index) => {
        doc.text(`${index + 1}. ${reg.userName}`);
        doc.text(`   Email: ${reg.userEmail}`);
        if (reg.userPhone) {
          doc.text(`   Phone: ${reg.userPhone}`);
        }
        if (reg.notes) {
          doc.text(`   Notes: ${reg.notes}`);
        }
        doc.moveDown(0.3);
      });

      doc.end();
    });
  }
}

export const exportService = new ExportService();
