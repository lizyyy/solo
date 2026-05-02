import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { Readable } from 'stream';
import { Ticket, TicketPriority, CreateTicketRequest, ImportResult } from '../types';

const CSV_COLUMNS = [
  'title',
  'customerName',
  'customerContact',
  'priority',
  'assignee',
  'tags',
  'description',
];

const CSV_HEADERS: Record<string, string> = {
  title: '标题',
  customerName: '客户名称',
  customerContact: '客户联系方式',
  priority: '优先级',
  assignee: '负责人',
  tags: '标签',
  description: '问题描述',
  status: '状态',
  createdAt: '创建时间',
  updatedAt: '更新时间',
};

const PRIORITY_MAP: Record<string, TicketPriority> = {
  '低': TicketPriority.LOW,
  'low': TicketPriority.LOW,
  'LOW': TicketPriority.LOW,
  '中': TicketPriority.MEDIUM,
  'medium': TicketPriority.MEDIUM,
  'MEDIUM': TicketPriority.MEDIUM,
  '高': TicketPriority.HIGH,
  'high': TicketPriority.HIGH,
  'HIGH': TicketPriority.HIGH,
  '紧急': TicketPriority.URGENT,
  'urgent': TicketPriority.URGENT,
  'URGENT': TicketPriority.URGENT,
};

function parsePriority(value: string | undefined): TicketPriority {
  if (!value) return TicketPriority.MEDIUM;
  const trimmed = value.trim();
  return PRIORITY_MAP[trimmed] || TicketPriority.MEDIUM;
}

export function parseCSVBuffer(buffer: Buffer): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const records: any[] = [];
    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
      encoding: 'utf-8',
    });

    const stream = Readable.from(buffer);
    stream.pipe(parser);

    parser.on('data', (record) => {
      records.push(record);
    });

    parser.on('end', () => {
      resolve(records);
    });

    parser.on('error', (error) => {
      reject(error);
    });
  });
}

export function validateAndTransformCSVRecords(records: any[]): {
  valid: { index: number; data: CreateTicketRequest }[];
  errors: { row: number; message: string }[];
} {
  const valid: { index: number; data: CreateTicketRequest }[] = [];
  const errors: { row: number; message: string }[] = [];

  records.forEach((record, index) => {
    const rowErrors: string[] = [];
    const row = index + 2;

    const title = record['标题'] || record['title'] || '';
    const customerName = record['客户名称'] || record['customerName'] || '';
    const customerContact = record['客户联系方式'] || record['customerContact'] || '';
    const description = record['问题描述'] || record['description'] || '';

    if (!title.trim()) {
      rowErrors.push('标题不能为空');
    }
    if (!customerName.trim()) {
      rowErrors.push('客户名称不能为空');
    }
    if (!customerContact.trim()) {
      rowErrors.push('客户联系方式不能为空');
    }
    if (!description.trim()) {
      rowErrors.push('问题描述不能为空');
    }

    if (rowErrors.length > 0) {
      errors.push({
        row,
        message: rowErrors.join('; '),
      });
    } else {
      valid.push({
        index: row,
        data: {
          title: title.trim(),
          customerName: customerName.trim(),
          customerContact: customerContact.trim(),
          priority: parsePriority(record['优先级'] || record['priority']),
          assignee: (record['负责人'] || record['assignee'] || '').trim(),
          tags: (record['标签'] || record['tags'] || '').trim(),
          description: description.trim(),
        },
      });
    }
  });

  return { valid, errors };
}

export async function exportTicketsToCSV(tickets: Ticket[]): Promise<string> {
  const records = tickets.map((ticket) => ({
    [CSV_HEADERS.title]: ticket.title,
    [CSV_HEADERS.customerName]: ticket.customerName,
    [CSV_HEADERS.customerContact]: ticket.customerContact,
    [CSV_HEADERS.priority]: ticket.priority,
    [CSV_HEADERS.assignee]: ticket.assignee,
    [CSV_HEADERS.tags]: ticket.tags,
    [CSV_HEADERS.description]: ticket.description,
    [CSV_HEADERS.status]: ticket.status,
    [CSV_HEADERS.createdAt]: ticket.createdAt,
    [CSV_HEADERS.updatedAt]: ticket.updatedAt,
  }));

  return new Promise((resolve, reject) => {
    stringify(records, {
      header: true,
      encoding: 'utf-8',
    }, (error, output) => {
      if (error) {
        reject(error);
      } else {
        resolve('\uFEFF' + output);
      }
    });
  });
}
