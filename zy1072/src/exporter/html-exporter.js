import * as fs from 'fs/promises';
import { groupBy } from '../utils.js';

export class HtmlExporter {
  constructor() {}

  async exportPrintCards(guests, tables, outputPath) {
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    const tableNumbers = Object.keys(guestsByTable).sort((a, b) => {
      const numA = parseInt(a) || a;
      const numB = parseInt(b) || b;
      if (typeof numA === 'number' && typeof numB === 'number') {
        return numA - numB;
      }
      return String(a).localeCompare(String(b));
    });

    const htmlContent = this._generateHtml(tableNumbers, guestsByTable, tableMap, guests, tables);
    await fs.writeFile(outputPath, htmlContent, 'utf8');

    return {
      path: outputPath,
      tables: tableNumbers.length,
      cards: seatedGuests.length
    };
  }

  _generateHtml(tableNumbers, guestsByTable, tableMap, allGuests, allTables) {
    const tableCards = [];
    const guestCards = [];

    for (const tableNumber of tableNumbers) {
      const tableGuests = guestsByTable[tableNumber];
      const table = tableMap.get(tableNumber);

      tableCards.push(this._generateTableCard(tableNumber, tableGuests, table));

      for (const guest of tableGuests) {
        guestCards.push(this._generateGuestCard(guest, tableNumber, table));
      }
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>座位表打印卡片</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @media print {
      .no-print {
        display: none;
      }
      @page {
        size: A4;
        margin: 15mm;
      }
      body {
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
      .page-break {
        page-break-after: always;
      }
    }

    body {
      font-family: 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }

    .no-print {
      background: #fff;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .no-print h1 {
      color: #333;
      margin-bottom: 10px;
    }

    .no-print .summary {
      color: #666;
      font-size: 14px;
    }

    .cards-container {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
    }

    @media (max-width: 800px) {
      .cards-container {
        grid-template-columns: 1fr;
      }
    }

    .table-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      padding: 25px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    }

    .table-number {
      font-size: 72px;
      font-weight: bold;
      margin-bottom: 10px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
    }

    .table-label {
      font-size: 24px;
      margin-bottom: 15px;
      opacity: 0.9;
    }

    .table-info {
      font-size: 14px;
      opacity: 0.8;
      text-align: center;
    }

    .guest-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      min-height: 180px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      border-left: 6px solid #667eea;
    }

    .guest-card.vip {
      border-left-color: #f59e0b;
      background: linear-gradient(to right, #fffbeb, white);
    }

    .guest-card.child {
      border-left-color: #10b981;
    }

    .guest-card.mobility {
      border-left-color: #ef4444;
    }

    .guest-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
    }

    .guest-name {
      font-size: 36px;
      font-weight: bold;
      color: #333;
    }

    .guest-tags {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }

    .tag {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      font-weight: 500;
    }

    .tag-vip {
      background: #f59e0b;
      color: white;
    }

    .tag-child {
      background: #10b981;
      color: white;
    }

    .tag-mobility {
      background: #ef4444;
      color: white;
    }

    .tag-diet {
      background: #8b5cf6;
      color: white;
    }

    .guest-table {
      font-size: 18px;
      color: #667eea;
      font-weight: 600;
      margin-bottom: 10px;
    }

    .guest-details {
      margin-top: auto;
      font-size: 13px;
      color: #666;
    }

    .detail-row {
      margin-bottom: 5px;
    }

    .detail-label {
      font-weight: 500;
      color: #444;
    }

    .dietary-warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 8px;
      margin-top: 10px;
      font-size: 12px;
      color: #92400e;
    }

    .section-title {
      grid-column: 1 / -1;
      font-size: 20px;
      font-weight: bold;
      color: #333;
      padding: 10px 0;
      border-bottom: 2px solid #667eea;
      margin-top: 20px;
    }

    .unseated-section {
      grid-column: 1 / -1;
      background: #fef2f2;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #fecaca;
    }

    .unseated-section h3 {
      color: #991b1b;
      margin-bottom: 15px;
    }

    .unseated-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }

    .unseated-item {
      background: white;
      padding: 10px;
      border-radius: 6px;
      border-left: 3px solid #ef4444;
    }
  </style>
</head>
<body>
  <div class="no-print">
    <h1>座位表打印卡片</h1>
    <div class="summary">
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      <p>桌数: ${tableNumbers.length} 桌 | 宾客: ${allGuests.length} 人 | 已入座: ${allGuests.filter(g => g.tableNumber).length} 人</p>
      <p style="margin-top: 10px; color: #888;">提示: 按 Ctrl+P 或 Cmd+P 打印此页面</p>
    </div>
  </div>

  <div class="cards-container">
    <div class="section-title">桌号卡（按桌排列）</div>
${tableCards.join('\n')}

    <div class="section-title">宾客座位卡</div>
${guestCards.join('\n')}
${this._generateUnseatedSection(allGuests)}
  </div>
</body>
</html>`;
  }

  _generateTableCard(tableNumber, guests, table) {
    const vipCount = guests.filter(g => g.isVIP).length;
    const childCount = guests.filter(g => g.isChild).length;
    const dietaryCount = guests.filter(g => g.dietaryRestrictions.length > 0).length;

    const infoParts = [];
    if (table?.area) infoParts.push(`区域: ${table.area}`);
    infoParts.push(`${guests.length}/${table?.capacity || '?'} 人`);
    if (vipCount > 0) infoParts.push(`VIP: ${vipCount}人`);
    if (childCount > 0) infoParts.push(`儿童: ${childCount}人`);
    if (dietaryCount > 0) infoParts.push(`饮食注意: ${dietaryCount}人`);

    return `
    <div class="table-card">
      <div class="table-number">${tableNumber}</div>
      <div class="table-label">桌</div>
      <div class="table-info">
        ${infoParts.join(' | ')}
      </div>
    </div>`;
  }

  _generateGuestCard(guest, tableNumber, table) {
    const tags = [];
    const cardClasses = ['guest-card'];

    if (guest.isVIP) {
      tags.push('<span class="tag tag-vip">VIP</span>');
      cardClasses.push('vip');
    }
    if (guest.isChild) {
      tags.push('<span class="tag tag-child">儿童</span>');
      cardClasses.push('child');
    }
    if (guest.isMobilityImpaired) {
      tags.push('<span class="tag tag-mobility">行动不便</span>');
      cardClasses.push('mobility');
    }

    const dietaryWarning = guest.dietaryRestrictions.length > 0
      ? `<div class="dietary-warning">
           <strong>饮食注意:</strong> ${guest.dietaryRestrictions.join('、')}
         </div>`
      : '';

    const details = [];
    if (guest.group) {
      details.push(`<div class="detail-row"><span class="detail-label">分组:</span> ${guest.group}</div>`);
    }
    if (guest.relationTags.length > 0) {
      details.push(`<div class="detail-row"><span class="detail-label">关系:</span> ${guest.relationTags.join('、')}</div>`);
    }
    if (guest.companions.length > 0) {
      details.push(`<div class="detail-row"><span class="detail-label">同行人:</span> ${guest.companions.join('、')}</div>`);
    }

    return `
    <div class="${cardClasses.join(' ')}">
      <div class="guest-header">
        <div class="guest-name">${guest.name}</div>
        <div class="guest-tags">
          ${tags.join('\n          ')}
        </div>
      </div>
      <div class="guest-table">桌号 ${tableNumber}</div>
      ${details.length > 0 ? `<div class="guest-details">${details.join('\n      ')}</div>` : ''}
      ${dietaryWarning}
    </div>`;
  }

  _generateUnseatedSection(guests) {
    const unseated = guests.filter(g => !g.tableNumber);
    if (unseated.length === 0) return '';

    const items = unseated.map(g => {
      const notes = [];
      if (g.isVIP) notes.push('VIP');
      if (g.isChild) notes.push('儿童');
      if (g.dietaryRestrictions.length > 0) notes.push(...g.dietaryRestrictions);

      return `
        <div class="unseated-item">
          <div style="font-weight: bold;">${g.name}</div>
          <div style="font-size: 12px; color: #666;">${g.group}${notes.length > 0 ? ' | ' + notes.join('、') : ''}</div>
        </div>`;
    }).join('');

    return `
    <div class="unseated-section">
      <h3>未分配座位宾客 (${unseated.length} 人)</h3>
      <div class="unseated-list">
${items}
      </div>
    </div>`;
  }
}

export default HtmlExporter;
