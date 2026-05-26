import * as fs from 'fs';
import csvParser = require('csv-parser');
import { AddItemRecord, PackageInfo, UnitAgreement, CouponInfo, ParsedData } from '../types';

export class FileParserService {
  async parseAddItemsCSV(filePath: string): Promise<AddItemRecord[]> {
    return new Promise((resolve, reject) => {
      const results: AddItemRecord[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data: any) => {
          results.push(this.mapToAddItemRecord(data));
        })
        .on('end', () => {
          resolve(results);
        })
        .on('error', reject);
    });
  }

  private mapToAddItemRecord(data: any): AddItemRecord {
    return {
      id: data.id || data.ID || data.recordId || '',
      customerName: data.customerName || data.客户姓名 || data.name || '',
      idCard: data.idCard || data.身份证号 || data.idNumber || '',
      phone: data.phone || data.手机号 || data.telephone || '',
      packageCode: data.packageCode || data.套餐编码 || data.pkgCode || '',
      itemCode: data.itemCode || data.项目编码 || data.code || '',
      itemName: data.itemName || data.项目名称 || data.name || '',
      itemPrice: parseFloat(data.itemPrice || data.项目价格 || data.price || '0'),
      quantity: parseInt(data.quantity || data.数量 || data.qty || '1', 10),
      couponCode: data.couponCode || data.优惠券编码 || data.coupon || undefined,
      couponAmount: data.couponAmount ? parseFloat(data.couponAmount) : 
                    data.优惠券金额 ? parseFloat(data.优惠券金额) : undefined,
      unitCode: data.unitCode || data.单位编码 || data.companyCode || undefined,
      operator: data.operator || data.操作员 || data.operatedBy || '',
      operationTime: data.operationTime || data.操作时间 || data.time || new Date().toISOString(),
      remark: data.remark || data.备注 || data.note || undefined,
      isRefund: (data.isRefund || data.是否退项 || data.refund) === 'true' || 
                (data.isRefund || data.是否退项 || data.refund) === true,
      originalRecordId: data.originalRecordId || data.原记录ID || undefined,
    };
  }

  parsePackagesJSON(filePath: string): PackageInfo[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : data.packages || data.data || [];
  }

  parseUnitAgreementJSON(filePath: string): UnitAgreement[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : data.units || data.agreements || data.data || [];
  }

  parseCouponsJSON(filePath: string): CouponInfo[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : data.coupons || data.data || [];
  }

  async parseAllFiles(
    addItemsPath?: string,
    packagesPath?: string,
    unitAgreementPath?: string,
    couponsPath?: string
  ): Promise<ParsedData> {
    const parsedData: ParsedData = {
      addItems: [],
      packages: [],
      unitAgreements: [],
      coupons: [],
    };

    if (addItemsPath) {
      parsedData.addItems = await this.parseAddItemsCSV(addItemsPath);
    }

    if (packagesPath) {
      parsedData.packages = this.parsePackagesJSON(packagesPath);
    }

    if (unitAgreementPath) {
      parsedData.unitAgreements = this.parseUnitAgreementJSON(unitAgreementPath);
    }

    if (couponsPath) {
      parsedData.coupons = this.parseCouponsJSON(couponsPath);
    }

    return parsedData;
  }
}
