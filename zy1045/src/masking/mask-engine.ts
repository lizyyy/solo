import { ConsistencyManager } from './consistency-manager';
import { FieldType } from '../types';

export class MaskEngine {
  private consistencyManager: ConsistencyManager;

  constructor(salt: string) {
    this.consistencyManager = new ConsistencyManager(salt);
  }

  maskField(
    value: any,
    fieldType: FieldType,
    fileName?: string
  ): { masked: any; wasMasked: boolean } {
    if (value === null || value === undefined) {
      return { masked: value, wasMasked: false };
    }

    const strValue = String(value);
    if (strValue.trim() === '') {
      return { masked: value, wasMasked: false };
    }

    switch (fieldType) {
      case 'phone':
        return this.maskPhone(strValue, fileName);
      case 'email':
        return this.maskEmail(strValue, fileName);
      case 'name':
        return this.maskName(strValue, fileName);
      case 'address':
        return this.maskAddress(strValue, fileName);
      case 'order_number':
        return this.maskOrderNumber(strValue, fileName);
      case 'ticket_number':
        return this.maskTicketNumber(strValue, fileName);
      case 'free_text':
        return this.maskFreeText(strValue, fileName);
      default:
        return { masked: value, wasMasked: false };
    }
  }

  private maskPhone(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    const phonePattern = /^[\d\-+()\s]+$/;
    
    if (!phonePattern.test(value) || value.length < 7) {
      return { masked: value, wasMasked: false };
    }

    const generator = (original: string, type: FieldType, salt: string, counter: number) => {
      const hash = ConsistencyManager.shortHash(original, salt, 6);
      return `186${hash.padStart(8, '0')}`;
    };

    const result = this.consistencyManager.getOrCreate(value, 'phone', generator, fileName);
    return { masked: result.masked, wasMasked: result.isNew || true };
  }

  private maskEmail(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailPattern.test(value)) {
      return { masked: value, wasMasked: false };
    }

    const generator = (original: string, type: FieldType, salt: string, counter: number) => {
      const [local, domain] = original.split('@');
      const hash = ConsistencyManager.shortHash(local, salt, 8);
      return `user${hash}@masked.example.com`;
    };

    const result = this.consistencyManager.getOrCreate(value, 'email', generator, fileName);
    return { masked: result.masked, wasMasked: result.isNew || true };
  }

  private maskName(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    const generator = (original: string, type: FieldType, salt: string, counter: number) => {
      const hash = ConsistencyManager.shortHash(original, salt, 6);
      
      const surnames = ['张', '王', '李', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
      const names = ['明', '华', '伟', '强', '芳', '娟', '敏', '静', '丽', '艳', '磊', '洋', '勇', '军'];
      
      const hashNum = parseInt(hash, 16);
      const surnameIdx = hashNum % surnames.length;
      const nameIdx1 = (hashNum >> 4) % names.length;
      const nameIdx2 = (hashNum >> 8) % names.length;
      
      return surnames[surnameIdx] + names[nameIdx1] + (hashNum % 3 === 0 ? names[nameIdx2] : '');
    };

    const result = this.consistencyManager.getOrCreate(value, 'name', generator, fileName);
    return { masked: result.masked, wasMasked: result.isNew || true };
  }

  private maskAddress(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    const generator = (original: string, type: FieldType, salt: string, counter: number) => {
      const hash = ConsistencyManager.shortHash(original, salt, 8);
      
      const cities = ['北京市', '上海市', '广州市', '深圳市', '杭州市', '成都市', '武汉市', '南京市'];
      const districts = ['朝阳区', '海淀区', '浦东新区', '南山区', '西湖区', '锦江区', '洪山区', '鼓楼区'];
      
      const hashNum = parseInt(hash, 16);
      const cityIdx = Math.abs(hashNum) % cities.length;
      const districtIdx = Math.abs(hashNum >> 4) % districts.length;
      const streetNum = Math.abs(hashNum >> 8) % 999 + 1;
      const buildingNum = Math.abs(hashNum >> 12) % 99 + 1;
      
      return `${cities[cityIdx]}${districts[districtIdx]}某某路${streetNum}号${buildingNum}室`;
    };

    const result = this.consistencyManager.getOrCreate(value, 'address', generator, fileName);
    return { masked: result.masked, wasMasked: result.isNew || true };
  }

  private maskOrderNumber(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    const generator = (original: string, type: FieldType, salt: string, counter: number) => {
      const hash = ConsistencyManager.shortHash(original, salt, 12);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      return `ORD${dateStr}${hash.toUpperCase()}`;
    };

    const result = this.consistencyManager.getOrCreate(value, 'order_number', generator, fileName);
    return { masked: result.masked, wasMasked: result.isNew || true };
  }

  private maskTicketNumber(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    const generator = (original: string, type: FieldType, salt: string, counter: number) => {
      const hash = ConsistencyManager.shortHash(original, salt, 10);
      return `TK${hash.toUpperCase()}`;
    };

    const result = this.consistencyManager.getOrCreate(value, 'ticket_number', generator, fileName);
    return { masked: result.masked, wasMasked: result.isNew || true };
  }

  private maskFreeText(value: string, fileName?: string): { masked: string; wasMasked: boolean } {
    let maskedValue = value;
    let wasMasked = false;

    const phonePattern = /1[3-9]\d{9}/g;
    maskedValue = maskedValue.replace(phonePattern, (match) => {
      const result = this.maskPhone(match, fileName);
      wasMasked = wasMasked || result.wasMasked;
      return result.masked;
    });

    const phonePattern2 = /(\+?86[-\s]?)?1[3-9]\d{1}([-*\s])?\d{4}\2\d{4}/g;
    maskedValue = maskedValue.replace(phonePattern2, (match) => {
      const cleaned = match.replace(/[-*\s+]/g, '').replace(/^86/, '');
      if (/^1[3-9]\d{9}$/.test(cleaned)) {
        const result = this.maskPhone(cleaned, fileName);
        wasMasked = wasMasked || result.wasMasked;
        return result.masked;
      }
      return match;
    });

    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    maskedValue = maskedValue.replace(emailPattern, (match) => {
      const result = this.maskEmail(match, fileName);
      wasMasked = wasMasked || result.wasMasked;
      return result.masked;
    });

    return { masked: maskedValue, wasMasked };
  }

  getConsistencyManager(): ConsistencyManager {
    return this.consistencyManager;
  }

  getMappingStats(): any {
    return this.consistencyManager.getStats();
  }
}
