import * as fs from 'fs';
import * as csv from 'csv-parser';
import { Receipt, Member, MemberLevel } from '../types';

export class FileParser {
  static parseReceiptsCSV(filePath: string): Promise<Receipt[]> {
    return new Promise((resolve, reject) => {
      const receipts: Receipt[] = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row: any) => {
          const receipt: Receipt = {
            id: row.id || `r_${Date.now()}_${Math.random()}`,
            receiptNo: row.receiptNo || row['小票编号'],
            storeCode: row.storeCode || row['门店编码'],
            storeName: row.storeName || row['门店名称'],
            memberId: row.memberId || row['会员ID'],
            memberPhone: row.memberPhone || row['会员手机号'],
            transactionTime: new Date(row.transactionTime || row['交易时间']),
            totalAmount: parseFloat(row.totalAmount || row['总金额'] || 0),
            discountAmount: parseFloat(row.discountAmount || row['优惠金额'] || 0),
            payAmount: parseFloat(row.payAmount || row['实付金额'] || 0),
            items: row.items ? JSON.parse(row.items) : [],
            isReturn: (row.isReturn || row['是否退货']) === 'true' || (row.isReturn || row['是否退货']) === '是',
            originalReceiptNo: row.originalReceiptNo || row['原小票编号']
          };
          receipts.push(receipt);
        })
        .on('end', () => resolve(receipts))
        .on('error', reject);
    });
  }

  static parseMembersJSON(filePath: string): Promise<Member[]> {
    return new Promise((resolve, reject) => {
      fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          const membersData = JSON.parse(data);
          const members: Member[] = membersData.map((row: any) => ({
            id: row.id || `m_${Date.now()}_${Math.random()}`,
            memberId: row.memberId,
            name: row.name,
            phone: row.phone,
            level: row.level as MemberLevel || MemberLevel.NORMAL,
            points: parseInt(row.points || 0),
            registerTime: new Date(row.registerTime),
            lastConsumeTime: row.lastConsumeTime ? new Date(row.lastConsumeTime) : undefined
          }));
          resolve(members);
        } catch (e) {
          reject(e);
        }
      });
    });
  }

  static parseReceiptsFromJSON(data: any[]): Receipt[] {
    return data.map((row: any, index: number) => ({
      id: row.id || `r_${Date.now()}_${index}`,
      receiptNo: row.receiptNo,
      storeCode: row.storeCode,
      storeName: row.storeName,
      memberId: row.memberId,
      memberPhone: row.memberPhone,
      transactionTime: new Date(row.transactionTime),
      totalAmount: parseFloat(row.totalAmount || 0),
      discountAmount: parseFloat(row.discountAmount || 0),
      payAmount: parseFloat(row.payAmount || 0),
      items: row.items || [],
      isReturn: row.isReturn || false,
      originalReceiptNo: row.originalReceiptNo
    }));
  }

  static parseMembersFromJSON(data: any[]): Member[] {
    return data.map((row: any, index: number) => ({
      id: row.id || `m_${Date.now()}_${index}`,
      memberId: row.memberId,
      name: row.name,
      phone: row.phone,
      level: row.level as MemberLevel || MemberLevel.NORMAL,
      points: parseInt(row.points || 0),
      registerTime: new Date(row.registerTime),
      lastConsumeTime: row.lastConsumeTime ? new Date(row.lastConsumeTime) : undefined
    }));
  }
}
