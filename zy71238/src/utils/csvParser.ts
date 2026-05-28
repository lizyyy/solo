import Papa from 'papaparse';
import type { IndexComponent } from '../types';

export function parseIndexCsv(file: File): Promise<IndexComponent[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const components: IndexComponent[] = results.data.map((row: any) => ({
            code: row.code || row.股票代码 || '',
            name: row.name || row.股票名称 || '',
            weight: parseFloat(row.weight || row.权重 || 0),
            price: parseFloat(row.price || row.价格 || 0),
            isSuspended: (row.isSuspended || row.是否停牌 || 'false').toLowerCase() === 'true',
            suspendedReason: row.suspendedReason || row.停牌原因 || undefined,
          }));
          
          const validComponents = components.filter(c => c.code && c.name);
          resolve(validComponents);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}

export function exportToCsv(data: any[], filename: string) {
  const csv = Papa.unparse(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
