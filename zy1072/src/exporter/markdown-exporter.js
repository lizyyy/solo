import * as fs from 'fs/promises';
import { groupBy, deduplicateArray } from '../utils.js';

export class MarkdownExporter {
  constructor() {}

  async exportKitchenNotes(guests, tables, outputPath) {
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    const allDietaryGuests = guests.filter(g => g.dietaryRestrictions.length > 0);
    const allRestrictions = deduplicateArray(
      allDietaryGuests.flatMap(g => g.dietaryRestrictions)
    );

    const mdLines = [];

    mdLines.push('# 厨房用餐注意事项');
    mdLines.push('');
    mdLines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    mdLines.push(`宾客总数: ${guests.length} 人`);
    mdLines.push(`桌位数: ${tables.length} 桌`);
    mdLines.push(`有饮食限制宾客: ${allDietaryGuests.length} 人`);
    mdLines.push('');

    if (allRestrictions.length > 0) {
      mdLines.push('## 饮食限制类型汇总');
      mdLines.push('');
      mdLines.push('| 限制类型 | 人数 |');
      mdLines.push('|----------|------|');
      
      for (const restriction of allRestrictions.sort()) {
        const count = allDietaryGuests.filter(g => 
          g.dietaryRestrictions.includes(restriction)
        ).length;
        mdLines.push(`| ${restriction} | ${count} 人 |`);
      }
      mdLines.push('');
    }

    mdLines.push('## 按桌号详细列表');
    mdLines.push('');

    const tableNumbers = Object.keys(guestsByTable).sort((a, b) => {
      const numA = parseInt(a) || a;
      const numB = parseInt(b) || b;
      if (typeof numA === 'number' && typeof numB === 'number') {
        return numA - numB;
      }
      return String(a).localeCompare(String(b));
    });

    for (const tableNumber of tableNumbers) {
      const tableGuests = guestsByTable[tableNumber];
      const table = tableMap.get(tableNumber);
      const dietaryGuests = tableGuests.filter(g => g.dietaryRestrictions.length > 0);

      mdLines.push(`### 桌号 ${tableNumber}`);
      mdLines.push('');
      if (table) {
        mdLines.push(`- 区域: ${table.area}`);
        mdLines.push(`- 容量: ${table.capacity} 人`);
        mdLines.push(`- 实际: ${tableGuests.length} 人`);
        mdLines.push(`- 儿童友好: ${table.isChildFriendly ? '是' : '否'}`);
      }
      mdLines.push('');

      if (dietaryGuests.length > 0) {
        mdLines.push('#### 需要特别注意的宾客');
        mdLines.push('');
        mdLines.push('| 姓名 | 分组 | 饮食限制 | 备注 |');
        mdLines.push('|------|------|----------|------|');

        for (const guest of dietaryGuests) {
          const notes = [];
          if (guest.isChild) notes.push('儿童');
          if (guest.isMobilityImpaired) notes.push('行动不便');
          if (guest.isVIP) notes.push('VIP');
          
          mdLines.push(
            `| ${guest.name} | ${guest.group} | ${guest.dietaryRestrictions.join('、')} | ${notes.join('、')} |`
          );
        }
        mdLines.push('');
      } else {
        mdLines.push('*本桌无特殊饮食限制宾客*');
        mdLines.push('');
      }
    }

    const vipGuests = guests.filter(g => g.isVIP);
    if (vipGuests.length > 0) {
      mdLines.push('## VIP 宾客列表');
      mdLines.push('');
      mdLines.push('| 姓名 | 桌号 | 分组 | 饮食限制 |');
      mdLines.push('|------|------|------|----------|');
      for (const guest of vipGuests) {
        mdLines.push(
          `| ${guest.name} | ${guest.tableNumber || '未分配'} | ${guest.group} | ${guest.dietaryRestrictions.join('、') || '无'} |`
        );
      }
      mdLines.push('');
    }

    const children = guests.filter(g => g.isChild);
    if (children.length > 0) {
      mdLines.push('## 儿童宾客列表');
      mdLines.push('');
      mdLines.push('| 姓名 | 桌号 | 同行人 | 饮食限制 |');
      mdLines.push('|------|------|--------|----------|');
      for (const guest of children) {
        mdLines.push(
          `| ${guest.name} | ${guest.tableNumber || '未分配'} | ${guest.companions.join('、') || '无'} | ${guest.dietaryRestrictions.join('、') || '无'} |`
        );
      }
      mdLines.push('');
    }

    const mobilityImpaired = guests.filter(g => g.isMobilityImpaired);
    if (mobilityImpaired.length > 0) {
      mdLines.push('## 行动不便宾客列表');
      mdLines.push('');
      mdLines.push('| 姓名 | 桌号 | 同行人 | 备注 |');
      mdLines.push('|------|------|--------|------|');
      for (const guest of mobilityImpaired) {
        const notes = [];
        if (guest.needsQuietZone) notes.push('需要安静区');
        mdLines.push(
          `| ${guest.name} | ${guest.tableNumber || '未分配'} | ${guest.companions.join('、') || '无'} | ${notes.join('、')} |`
        );
      }
      mdLines.push('');
    }

    const unseated = guests.filter(g => !g.tableNumber);
    if (unseated.length > 0) {
      mdLines.push('## 未分配座位宾客');
      mdLines.push('');
      mdLines.push('| 姓名 | 分组 | 关系标签 | 饮食限制 |');
      mdLines.push('|------|------|----------|----------|');
      for (const guest of unseated) {
        mdLines.push(
          `| ${guest.name} | ${guest.group} | ${guest.relationTags.join('、')} | ${guest.dietaryRestrictions.join('、') || '无'} |`
        );
      }
      mdLines.push('');
    }

    mdLines.push('---');
    mdLines.push('');
    mdLines.push('**注意:** 此文档由座位表检查器自动生成，请在现场前再次核对确认。');

    const content = mdLines.join('\n');
    await fs.writeFile(outputPath, content, 'utf8');

    return {
      path: outputPath,
      tables: tableNumbers.length,
      dietaryGuests: allDietaryGuests.length,
      restrictionTypes: allRestrictions.length,
      vipGuests: vipGuests.length,
      children: children.length,
      mobilityImpaired: mobilityImpaired.length,
      unseated: unseated.length
    };
  }
}

export default MarkdownExporter;
