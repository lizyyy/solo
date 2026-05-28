import { SubjectRepository } from '../repositories/SubjectRepository';
import type { SubjectSuggestion, Direction } from '../../shared/types';

export class SubjectService {
  static suggestSubjects(description: string, amount: number, isIncome: boolean): SubjectSuggestion[] {
    const suggestions: SubjectSuggestion[] = [];
    const subjects = SubjectRepository.findAll();
    const descLower = description.toLowerCase();

    if (isIncome) {
      if (descLower.includes('销售') || descLower.includes('主营') || descLower.includes('货款')) {
        const sub = subjects.find(s => s.code === '6001');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 90, reason: '销售收入应计入主营业务收入' });
      }
      if (descLower.includes('其他') || descLower.includes('副业')) {
        const sub = subjects.find(s => s.code === '6051');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 80, reason: '非经常性收入计入其他业务收入' });
      }
      if (descLower.includes('预收') || descLower.includes('定金')) {
        const sub = subjects.find(s => s.code === '2203');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 85, reason: '预收款项应计入预收账款' });
      }
      const cash = subjects.find(s => s.code === '1001');
      if (cash && suggestions.length === 0) {
        suggestions.push({ subjectId: cash.id, subjectCode: cash.code, subjectName: cash.name, confidence: 60, reason: '现金收入增加库存现金' });
      }
    } else {
      if (descLower.includes('办公') || descLower.includes('文具') || descLower.includes('耗材')) {
        const sub = subjects.find(s => s.code === '6602');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 90, reason: '办公类支出计入管理费用' });
      }
      if (descLower.includes('餐饮') || descLower.includes('招待') || descLower.includes('饭')) {
        const sub = subjects.find(s => s.code === '6602');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 85, reason: '招待餐费计入管理费用-业务招待费' });
      }
      if (descLower.includes('差旅') || descLower.includes('酒店') || descLower.includes('机票') || descLower.includes('高铁')) {
        const sub = subjects.find(s => s.code === '6602');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 88, reason: '出差费用计入管理费用-差旅费' });
      }
      if (descLower.includes('加油') || descLower.includes('交通') || descLower.includes('打车') || descLower.includes('滴滴')) {
        const sub = subjects.find(s => s.code === '6602');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 80, reason: '交通费用计入管理费用' });
      }
      if (descLower.includes('采购') || descLower.includes('原材料') || descLower.includes('库存')) {
        const sub = subjects.find(s => s.code === '1403');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 92, reason: '原材料采购计入原材料科目' });
      }
      if (descLower.includes('工资') || descLower.includes('薪酬') || descLower.includes('薪金')) {
        const sub = subjects.find(s => s.code === '2211');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 95, reason: '工资发放通过应付职工薪酬核算' });
      }
      if (descLower.includes('水电') || descLower.includes('物业') || descLower.includes('房租')) {
        const sub = subjects.find(s => s.code === '6602');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 82, reason: '水电物业费计入管理费用' });
      }
      if (descLower.includes('销售') || descLower.includes('广告') || descLower.includes('推广')) {
        const sub = subjects.find(s => s.code === '6601');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 85, reason: '销售推广费用计入销售费用' });
      }
      if (descLower.includes('利息') || descLower.includes('手续费') || descLower.includes('银行')) {
        const sub = subjects.find(s => s.code === '6603');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 85, reason: '银行相关费用计入财务费用' });
      }
      if (descLower.includes('固定资产') || descLower.includes('设备') || descLower.includes('电脑') || amount >= 2000) {
        const sub = subjects.find(s => s.code === '1601');
        if (sub) suggestions.push({ subjectId: sub.id, subjectCode: sub.code, subjectName: sub.name, confidence: 75, reason: '大额设备采购可能计入固定资产' });
      }
      const cash = subjects.find(s => s.code === '1001');
      if (cash && suggestions.length === 0) {
        suggestions.push({ subjectId: cash.id, subjectCode: cash.code, subjectName: cash.name, confidence: 60, reason: '现金支出减少库存现金' });
      }
    }

    if (suggestions.length === 0) {
      const mgmt = subjects.find(s => s.code === '6602');
      if (mgmt) suggestions.push({ subjectId: mgmt.id, subjectCode: mgmt.code, subjectName: mgmt.name, confidence: 50, reason: '无法明确分类，暂计入管理费用，建议人工复核' });
    }

    return suggestions.slice(0, 3);
  }

  static validateMapping(subjectId: string, direction: Direction, amount: number, description: string): { valid: boolean; warnings: string[] } {
    const subject = SubjectRepository.findById(subjectId);
    if (!subject) return { valid: false, warnings: ['科目不存在'] };

    const warnings: string[] = [];
    const descLower = description.toLowerCase();

    if (subject.category === 'revenue' && direction === 'debit') {
      warnings.push('收入类科目通常在贷方，借方发生请确认是否为冲销');
    }
    if (subject.category === 'expense' && direction === 'credit') {
      warnings.push('费用类科目通常在借方，贷方发生请确认是否为冲销');
    }
    if (subject.category === 'asset' && subject.direction === 'debit' && direction === 'credit' && amount > 10000) {
      warnings.push('资产类科目大额贷方发生，请注意是否存在资产减值');
    }
    if (subject.code === '2202' && descLower.includes('收入')) {
      warnings.push('应付账款核算收入类交易可能存在科目错配，建议使用收入类科目');
    }
    if (subject.code === '6602' && descLower.includes('销售') && !descLower.includes('招待')) {
      warnings.push('销售相关费用建议计入销售费用而非管理费用');
    }

    return { valid: warnings.length === 0, warnings };
  }
}
