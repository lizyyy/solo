import { VendorRepository } from '../repositories/VendorRepository';
import { Vendor, Category, ImportError } from '../../shared/types';

export class VendorService {
  private vendorRepository: VendorRepository;

  constructor() {
    this.vendorRepository = new VendorRepository();
  }

  getAllVendors(): Vendor[] {
    return this.vendorRepository.findAll();
  }

  getVendorById(id: string): Vendor | undefined {
    return this.vendorRepository.findById(id);
  }

  createVendor(
    data: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
  ): Vendor {
    this.validateVendor(data);
    return this.vendorRepository.create(data);
  }

  updateVendor(
    id: string,
    data: Partial<Omit<Vendor, 'id' | 'createdAt'>>
  ): Vendor | undefined {
    if (data.name !== undefined || data.category !== undefined || data.powerRequirement !== undefined) {
      const existing = this.vendorRepository.findById(id);
      if (existing) {
        this.validateVendor({
          ...existing,
          ...data,
        });
      }
    }
    return this.vendorRepository.update(id, data);
  }

  deleteVendor(id: string): boolean {
    return this.vendorRepository.delete(id);
  }

  getVendorsByCategory(category: Category): Vendor[] {
    return this.vendorRepository.findByCategory(category);
  }

  searchVendors(name: string): Vendor[] {
    return this.vendorRepository.search(name);
  }

  bulkImport(
    data: Array<Partial<Vendor>>,
    source: string = '批量导入'
  ): { success: Vendor[]; errors: ImportError[] } {
    const success: Vendor[] = [];
    const errors: ImportError[] = [];

    const validVendors: Array<Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>> =
      [];

    data.forEach((row, index) => {
      const rowNumber = index + 1;
      try {
        const vendor = this.validateVendorRow(row, rowNumber, source);
        validVendors.push({ ...vendor, source });
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

    if (validVendors.length > 0) {
      const created = this.vendorRepository.bulkCreate(validVendors);
      success.push(...created);
    }

    return { success, errors };
  }

  private validateVendorRow(
    row: Partial<Vendor>,
    rowNumber: number,
    source: string
  ): Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'> {
    if (!row.name || !row.name.trim()) {
      const error: any = new Error('摊主名称不能为空');
      error.field = 'name';
      error.value = row.name || '';
      error.rowNumber = rowNumber;
      throw error;
    }

    const validCategories: Category[] = ['ceramic', 'print', 'food', 'other'];
    if (!row.category || !validCategories.includes(row.category)) {
      const error: any = new Error(
        `品类必须是: ${validCategories.join(', ')}`
      );
      error.field = 'category';
      error.value = row.category || '';
      error.rowNumber = rowNumber;
      throw error;
    }

    const power = Number(row.powerRequirement);
    if (isNaN(power) || power < 0) {
      const error: any = new Error('用电需求必须是大于等于0的数字');
      error.field = 'powerRequirement';
      error.value = String(row.powerRequirement);
      error.rowNumber = rowNumber;
      throw error;
    }

    return {
      name: row.name.trim(),
      category: row.category,
      powerRequirement: power,
      contact: row.contact || '',
      note: row.note,
    };
  }

  private validateVendor(
    data: Partial<Vendor>
  ): asserts data is Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'> {
    if (!data.name || !data.name.trim()) {
      throw new Error('摊主名称不能为空');
    }

    const validCategories: Category[] = ['ceramic', 'print', 'food', 'other'];
    if (!data.category || !validCategories.includes(data.category)) {
      throw new Error(`品类必须是: ${validCategories.join(', ')}`);
    }

    if (data.powerRequirement === undefined || data.powerRequirement < 0) {
      throw new Error('用电需求必须是大于等于0的数字');
    }
  }
}
