import { TicketExport, SplitStatus } from '../models';
import { dataStore } from './dataStore';

export interface RawTicketRow {
  ticketId: string;
  musicianName: string;
  liveDate: string;
  totalTips: string;
  platformFee: string;
  splitRatio: string;
  authorizedCities: string;
  audioFileId: string;
}

export function parseTicketRow(row: RawTicketRow): TicketExport {
  const totalTips = parseFloat(row.totalTips);
  const platformFee = parseFloat(row.platformFee);
  const splitRatio = parseFloat(row.splitRatio);
  const netTips = totalTips - platformFee;
  const expectedRevenue = netTips * splitRatio;

  const authorizedCities = row.authorizedCities
    .split(/[,，、;；]/)
    .map(c => c.trim())
    .filter(c => c.length > 0);

  return {
    id: `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    ticketId: row.ticketId,
    musicianName: row.musicianName,
    liveDate: row.liveDate,
    totalTips,
    platformFee,
    splitRatio,
    expectedRevenue,
    authorizedCities,
    audioFileId: row.audioFileId,
    importedAt: new Date().toISOString(),
    status: SplitStatus.IMPORTED
  };
}

export function importTicketRows(rows: RawTicketRow[]): TicketExport[] {
  const tickets: TicketExport[] = [];
  
  for (const row of rows) {
    const ticket = parseTicketRow(row);
    dataStore.addTicket(ticket);
    tickets.push(ticket);
  }

  return tickets;
}

export function importSampleTickets(): TicketExport[] {
  const sampleRows: RawTicketRow[] = [
    {
      ticketId: 'TK20250601001',
      musicianName: '张小北',
      liveDate: '2025-06-01',
      totalTips: '12580.00',
      platformFee: '1258.00',
      splitRatio: '0.7',
      authorizedCities: '北京,上海,广州,深圳',
      audioFileId: 'AUD20250601001'
    },
    {
      ticketId: 'TK20250601002',
      musicianName: '李南风',
      liveDate: '2025-06-01',
      totalTips: '8960.00',
      platformFee: '896.00',
      splitRatio: '0.65',
      authorizedCities: '北京,上海',
      audioFileId: 'AUD20250601002'
    },
    {
      ticketId: 'TK20250602001',
      musicianName: '王夕阳',
      liveDate: '2025-06-02',
      totalTips: '15600.00',
      platformFee: '1560.00',
      splitRatio: '0.7',
      authorizedCities: '北京,上海,广州',
      audioFileId: 'AUD20250602001'
    },
    {
      ticketId: 'TK20250602002',
      musicianName: '陈星辰',
      liveDate: '2025-06-02',
      totalTips: '6750.00',
      platformFee: '675.00',
      splitRatio: '0.6',
      authorizedCities: '北京',
      audioFileId: 'AUD20250602002'
    },
    {
      ticketId: 'TK20250603001',
      musicianName: '赵云端',
      liveDate: '2025-06-03',
      totalTips: '23400.00',
      platformFee: '2340.00',
      splitRatio: '0.75',
      authorizedCities: '北京,上海,广州,深圳,杭州',
      audioFileId: 'AUD20250603001'
    }
  ];

  return importTicketRows(sampleRows);
}
