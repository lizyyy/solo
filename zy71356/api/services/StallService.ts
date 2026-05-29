import { StallRepository } from '../repositories/StallRepository';
import { Stall, ImportError } from '../../shared/types';

export class StallService {
  private stallRepository: StallRepository;

  constructor() {
    this.stallRepository = new StallRepository();
  }

  getAllStalls(): Stall[] {
    return this.stallRepository.findAll();
  }

  getStallById(id: string): Stall | undefined {
    return this.stallRepository.findById(id);
  }

  createStall(data: Omit<Stall, 'id'>): Stall {
    this.validateStall(data);
    return this.stallRepository.create(data);
  }

  updateStall(
    id: string,
    data: Partial<Omit<Stall, 'id'>>
  ): Stall | undefined {
    const existing = this.stallRepository.findById(id);
    if (existing) {
      this.validateStall({ ...existing, ...data });
    }
    return this.stallRepository.update(id, data);
  }

  deleteStall(id: string): boolean {
    return this.stallRepository.delete(id);
  }

  getEntranceStalls(): Stall[] {
    return this.stallRepository.findEntranceStalls();
  }

  getGridDimensions(): { maxRow: number; maxCol: number } {
    return this.stallRepository.findMaxDimensions();
  }

  clearAndReplaceGrid(stalls: Omit<Stall, 'id'>[]): Stall[] {
    stalls.forEach((stall, index) => {
      this.validateStall(stall, index + 1);
    });
    this.stallRepository.clearAll();
    return this.stallRepository.bulkCreate(stalls);
  }

  bulkImport(
    data: Array<Partial<Stall>>,
    source: string = '批量导入'
  ): { success: Stall[]; errors: ImportError[] } {
    const success: Stall[] = [];
    const errors: ImportError[] = [];
    const validStalls: Array<Omit<Stall, 'id'>> = [];

    data.forEach((row, index) => {
      const rowNumber = index + 1;
      try {
        const stall = this.validateStallRow(row, rowNumber, source);
        validStalls.push(stall);
      } catch (e: any) {
        errors.push({
          row: rowNumber,
          field: e.field || 'unknown',
          value: e.value || '',
          message: e.message,
          source,
        });
      }
    });

    if (validStalls.length > 0) {
      const created = this.stallRepository.bulkCreate(validStalls);
      success.push(...created);
    }

    return { success, errors };
  }

  private validateStallRow(
    row: Partial<Stall>,
    rowNumber: number,
    source: string
  ): Omit<Stall, 'id'> {
    if (!row.name || !row.name.trim()) {
      const error: any = new Error('摊位名称不能为空');
      error.field = 'name';
      error.value = row.name || '';
      error.rowNumber = rowNumber;
      throw error;
    }

    const rowNum = Number(row.row);
    if (isNaN(rowNum) || rowNum < 0) {
      const error: any = new Error('行号必须是大于等于0的数字');
      error.field = 'row';
      error.value = String(row.row);
      error.rowNumber = rowNumber;
      throw error;
    }

    const colNum = Number(row.col);
    if (isNaN(colNum) || colNum < 0) {
      const error: any = new Error('列号必须是大于等于0的数字');
      error.field = 'col';
      error.value = String(row.col);
      error.rowNumber = rowNumber;
      throw error;
    }

    const maxPower = Number(row.maxPower);
    if (isNaN(maxPower) || maxPower < 0) {
      const error: any = new Error('最大供电必须是大于等于0的数字');
      error.field = 'maxPower';
      error.value = String(row.maxPower);
      error.rowNumber = rowNumber;
      throw error;
    }

    return {
      name: row.name.trim(),
      row: rowNum,
      col: colNum,
      maxPower,
      isEntrance: Boolean(row.isEntrance),
      width: Number(row.width) || 1,
      height: Number(row.height) || 1,
    };
  }

  private validateStall(data: Partial<Stall>, rowNumber?: number): void {
    if (!data.name || !data.name.trim()) {
      const error: any = new Error('摊位名称不能为空');
      if (rowNumber) error.rowNumber = rowNumber;
      throw error;
    }

    if (data.row === undefined || data.row < 0) {
      const error: any = new Error('行号必须是大于等于0的数字');
      if (rowNumber) error.rowNumber = rowNumber;
      throw error;
    }

    if (data.col === undefined || data.col < 0) {
      const error: any = new Error('列号必须是大于等于0的数字');
      if (rowNumber) error.rowNumber = rowNumber;
      throw error;
    }

    if (data.maxPower === undefined || data.maxPower < 0) {
      const error: any = new Error('最大供电必须是大于等于0的数字');
      if (rowNumber) error.rowNumber = rowNumber;
      throw error;
    }
  }
}
