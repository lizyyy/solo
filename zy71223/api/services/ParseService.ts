import type { ParseResult } from '../../shared/types';

export class ParseService {
  static simulateParse(imagePath: string, fileName: string): Omit<ParseResult, 'id' | 'parsedAt'> {
    const keywords: { [key: string]: { amount: number; merchant: string; desc: string } } = {
      '餐饮': { amount: 350.00, merchant: 'XX餐厅', desc: '客户招待餐费' },
      '加油': { amount: 450.00, merchant: '中石化', desc: '车辆加油费' },
      '办公': { amount: 280.00, merchant: 'XX文具店', desc: '办公用品采购' },
      '差旅': { amount: 1280.00, merchant: 'XX酒店', desc: '出差住宿费' },
      '住宿': { amount: 1280.00, merchant: 'XX酒店', desc: '出差住宿费' },
      '交通': { amount: 85.00, merchant: '滴滴出行', desc: '市内交通费' },
      '滴滴': { amount: 85.00, merchant: '滴滴出行', desc: '市内交通费' },
      '采购': { amount: 5600.00, merchant: 'XX供应商', desc: '原材料采购' },
      '原材料': { amount: 5600.00, merchant: 'XX供应商', desc: '原材料采购' },
      '工资': { amount: 15000.00, merchant: '工资发放', desc: '员工工资发放' },
      '水电': { amount: 320.00, merchant: '供电局', desc: '水电费' },
      '物业': { amount: 800.00, merchant: 'XX物业', desc: '物业费' },
      '销售': { amount: 6800.00, merchant: '零售收入', desc: '销售收入' },
    };

    const lowerName = fileName.toLowerCase();
    let result = {
      amount: 500.00,
      date: new Date().toISOString().split('T')[0],
      description: '现金支出',
      merchant: '未知商户',
      confidence: 75,
      rawText: '',
    };

    for (const [keyword, value] of Object.entries(keywords)) {
      if (lowerName.includes(keyword)) {
        result = { 
          ...result,
          amount: value.amount,
          merchant: value.merchant,
          description: value.desc,
          confidence: 85,
        };
        break;
      }
    }

    if (lowerName.includes('blur') || lowerName.includes('模糊')) {
      result.confidence = 45;
      result.rawText = '[图片模糊，部分文字无法识别] 金额：¥XXX.00 日期：202X-XX-XX';
    } else {
      result.rawText = `${result.merchant} ¥${result.amount.toFixed(2)} 日期：${result.date} ${result.description}`;
    }

    return {
      voucherId: '',
      amount: result.amount,
      date: result.date,
      description: result.description,
      merchant: result.merchant,
      confidence: result.confidence,
      rawText: result.rawText,
    };
  }

  static detectClarity(imagePath: string, fileName: string): number {
    if (fileName.toLowerCase().includes('blur') || fileName.toLowerCase().includes('模糊')) {
      return 55;
    }
    return Math.floor(Math.random() * 20) + 80;
  }
}
