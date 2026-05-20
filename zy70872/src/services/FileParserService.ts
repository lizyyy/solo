import * as csv from 'csv-parser';
import { Readable } from 'stream';
import { Showtime, BoxOffice } from '../types';

export class FileParserService {
  public async parseShowtimeCSV(buffer: Buffer): Promise<Omit<Showtime, 'id' | 'batchId' | 'isCrossDay'>[]> {
    const results: Omit<Showtime, 'id' | 'batchId' | 'isCrossDay'>[] = [];
    
    return new Promise((resolve, reject) => {
      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);

      readable
        .pipe(csv())
        .on('data', (data: any) => {
          results.push({
            filmName: data.filmName || data['影片名称'],
            hallName: data.hallName || data['影厅'],
            startTime: data.startTime || data['开始时间'],
            endTime: data.endTime || data['结束时间'],
            date: data.date || data['日期'],
            seats: parseInt(data.seats || data['座位数'] || '0', 10),
            price: parseFloat(data.price || data['票价'] || '0')
          });
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  public parseBoxOfficeJSON(buffer: Buffer): Omit<BoxOffice, 'id' | 'batchId'>[] {
    const content = buffer.toString('utf8');
    const data = JSON.parse(content);
    
    if (Array.isArray(data)) {
      return data.map(item => ({
        showtimeId: item.showtimeId || '',
        filmName: item.filmName || '',
        date: item.date || new Date().toISOString().split('T')[0],
        ticketsSold: parseInt(item.ticketsSold || item.tickets_sold || '0', 10),
        grossAmount: parseFloat(item.grossAmount || item.gross_amount || '0'),
        refundAmount: parseFloat(item.refundAmount || item.refund_amount || '0'),
        subsidyAmount: parseFloat(item.subsidyAmount || item.subsidy_amount || '0'),
        netAmount: parseFloat(item.netAmount || item.net_amount || '0')
      }));
    }
    
    throw new Error('JSON 数据格式错误，需要数组格式');
  }

  public validateShowtimeData(showtimes: Omit<Showtime, 'id' | 'batchId' | 'isCrossDay'>[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < showtimes.length; i++) {
      const st = showtimes[i];
      const lineNum = i + 2;

      if (!st.filmName) {
        errors.push(`第 ${lineNum} 行：影片名称不能为空`);
      }
      if (!st.hallName) {
        errors.push(`第 ${lineNum} 行：影厅不能为空`);
      }
      if (!st.startTime) {
        errors.push(`第 ${lineNum} 行：开始时间不能为空`);
      }
      if (!st.endTime) {
        errors.push(`第 ${lineNum} 行：结束时间不能为空`);
      }
      if (!st.date) {
        errors.push(`第 ${lineNum} 行：日期不能为空`);
      }
      if (isNaN(st.seats) || st.seats <= 0) {
        errors.push(`第 ${lineNum} 行：座位数必须是正整数`);
      }
      if (isNaN(st.price) || st.price < 0) {
        errors.push(`第 ${lineNum} 行：票价不能为负数`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  public validateBoxOfficeData(boxOffices: Omit<BoxOffice, 'id' | 'batchId'>[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    for (let i = 0; i < boxOffices.length; i++) {
      const bo = boxOffices[i];

      if (!bo.filmName) {
        errors.push(`第 ${i + 1} 条数据：影片名称不能为空`);
      }
      if (isNaN(bo.grossAmount) || bo.grossAmount < 0) {
        errors.push(`第 ${i + 1} 条数据：票房不能为负数`);
      }
      if (isNaN(bo.refundAmount) || bo.refundAmount < 0) {
        errors.push(`第 ${i + 1} 条数据：退票金额不能为负数`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
