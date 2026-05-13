import * as XLSX from 'xlsx';
import { ImportSummary } from './budgetService';
export type ImportType = 'budget' | 'purchase' | 'payment';
export interface ImportOptions {
    type: ImportType;
    sheetName?: string;
    period?: string;
}
export declare function importFromExcel(filePath: string, options: ImportOptions): ImportSummary;
export declare function generateTemplate(type: ImportType): XLSX.WorkBook;
export declare function saveTemplate(type: ImportType, outputPath: string): void;
//# sourceMappingURL=excelService.d.ts.map