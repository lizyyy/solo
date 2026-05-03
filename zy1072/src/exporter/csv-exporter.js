import * as fs from 'fs/promises';
import { groupBy } from '../utils.js';

export class CsvExporter {
  constructor() {}

  async exportSeatingPlan(guests, tables, outputPath) {
    const tableMap = new Map(tables.map(t => [t.tableNumber, t]));
    const seatedGuests = guests.filter(g => g.tableNumber);
    const guestsByTable = groupBy(seatedGuests, 'tableNumber');

    const csvLines = [];
    const headers = [
      '桌号',
      '区域',
      '桌容量',
      '当前人数',
      '姓名',
      '分组',
      '关系标签',
      '是否VIP',
      '是否儿童',
      '是否行动不便',
      '忌口/过敏',
      '备注'
    ];
    csvLines.push(headers.join(','));

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

      for (let i = 0; i < tableGuests.length; i++) {
        const guest = tableGuests[i];
        const isFirstInTable = i === 0;

        const row = [
          this._escapeCsvField(isFirstInTable ? tableNumber : ''),
          this._escapeCsvField(isFirstInTable && table ? table.area : ''),
          this._escapeCsvField(isFirstInTable && table ? String(table.capacity) : ''),
          this._escapeCsvField(isFirstInTable ? String(tableGuests.length) : ''),
          this._escapeCsvField(guest.name),
          this._escapeCsvField(guest.group),
          this._escapeCsvField(guest.relationTags.join('、')),
          this._escapeCsvField(guest.isVIP ? '是' : '否'),
          this._escapeCsvField(guest.isChild ? '是' : '否'),
          this._escapeCsvField(guest.isMobilityImpaired ? '是' : '否'),
          this._escapeCsvField(guest.dietaryRestrictions.join('、')),
          this._escapeCsvField(this._generateGuestNotes(guest))
        ];
        csvLines.push(row.join(','));
      }
    }

    const unseatedGuests = guests.filter(g => !g.tableNumber);
    if (unseatedGuests.length > 0) {
      csvLines.push('');
      csvLines.push('未分配座位宾客');
      csvLines.push('姓名,分组,关系标签,忌口/过敏,备注');
      for (const guest of unseatedGuests) {
        const row = [
          this._escapeCsvField(guest.name),
          this._escapeCsvField(guest.group),
          this._escapeCsvField(guest.relationTags.join('、')),
          this._escapeCsvField(guest.dietaryRestrictions.join('、')),
          this._escapeCsvField(this._generateGuestNotes(guest))
        ];
        csvLines.push(row.join(','));
      }
    }

    const content = csvLines.join('\n');
    await fs.writeFile(outputPath, '\ufeff' + content, 'utf8');

    return {
      path: outputPath,
      tables: tableNumbers.length,
      seatedGuests: seatedGuests.length,
      unseatedGuests: unseatedGuests.length,
      totalGuests: guests.length
    };
  }

  _escapeCsvField(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  _generateGuestNotes(guest) {
    const notes = [];
    if (guest.companions.length > 0) {
      notes.push(`同行人: ${guest.companions.join('、')}`);
    }
    if (guest.preferWith.length > 0) {
      notes.push(`优先同桌: ${guest.preferWith.join('、')}`);
    }
    if (guest.avoidWith.length > 0) {
      notes.push(`避免同桌: ${guest.avoidWith.join('、')}`);
    }
    if (guest.needsQuietZone) {
      notes.push('需要安静区');
    }
    return notes.join(' | ');
  }
}

export default CsvExporter;
