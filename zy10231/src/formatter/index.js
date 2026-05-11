function formatTimestamp(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function pad(str, length, char = ' ') {
  str = String(str || '');
  if (str.length >= length) return str.substring(0, length);
  return str + char.repeat(length - str.length);
}

function printHeader(title) {
  const line = '='.repeat(80);
  return `\n${line}\n  ${title}\n${line}\n`;
}

function formatPrintList(items, batchNumber) {
  let output = printHeader(`打印清单 - 批次 ${batchNumber}`);
  
  const cols = {
    seq: 4,
    badge: 14,
    name: 12,
    company: 22,
    type: 10,
    zone: 12,
    status: 10
  };
  
  output += pad('序号', cols.seq) + pad('胸牌编号', cols.badge) + 
            pad('姓名', cols.name) + pad('公司', cols.company) +
            pad('类型', cols.type) + pad('权限区域', cols.zone) +
            pad('签到状态', cols.status) + '\n';
  output += '-'.repeat(80) + '\n';
  
  items.forEach((item, idx) => {
    const attendee = item.attendee || item;
    output += 
      pad(String(idx + 1), cols.seq) +
      pad(attendee.badgeNumber || '-', cols.badge) +
      pad(attendee.name || '-', cols.name) +
      pad((attendee.company || '-').substring(0, 20), cols.company) +
      pad(attendee.guestType || '-', cols.type) +
      pad((attendee.permissionZone || '-').substring(0, 10), cols.zone) +
      pad(attendee.checkinStatus || '-', cols.status) +
      '\n';
  });
  
  output += '-'.repeat(80) + '\n';
  output += `总计: ${items.length} 人\n`;
  output += `生成时间: ${formatTimestamp(new Date().toISOString())}\n`;
  output += `说明: 此清单可直接提交打印组，按胸牌编号分拣后发放\n`;
  
  return output;
}

function formatReprintHistory(records, attendeeName = null) {
  const title = attendeeName 
    ? `补打历史 - ${attendeeName}` 
    : '全部补打历史记录';
  
  let output = printHeader(title);
  
  const cols = {
    batch: 12,
    time: 20,
    badge: 14,
    name: 12,
    company: 18,
    type: 10,
    reason: 16,
    count: 6
  };
  
  output += pad('批次号', cols.batch) + pad('操作时间', cols.time) +
            pad('胸牌编号', cols.badge) + pad('姓名', cols.name) +
            pad('公司', cols.company) + pad('类型', cols.type) +
            pad('补打原因', cols.reason) + pad('次数', cols.count) + '\n';
  output += '-'.repeat(80) + '\n';
  
  let totalReprints = 0;
  
  records.forEach(record => {
    if (record.type === 'confirm' && record.details?.operations) {
      record.details.operations.forEach(op => {
        if (op.operationType === 'reprint' || op.reprintReason) {
          output += 
            pad(record.batchNumber || '-', cols.batch) +
            pad(formatTimestamp(record.timestamp), cols.time) +
            pad(op.attendee?.badgeNumber || '-', cols.badge) +
            pad(op.attendee?.name || '-', cols.name) +
            pad((op.attendee?.company || '-').substring(0, 16), cols.company) +
            pad(op.attendee?.guestType || '-', cols.type) +
            pad((op.reprintReason || '-').substring(0, 14), cols.reason) +
            pad(String(op.reprintCount || 1), cols.count) +
            '\n';
          totalReprints++;
        }
      });
    }
  });
  
  output += '-'.repeat(80) + '\n';
  output += `补打记录总数: ${totalReprints}\n`;
  
  return output;
}

function formatValidationReport(validation, context) {
  let output = '';
  
  if (context) {
    output += `\n【检查】${context}\n`;
  }
  
  if (validation.errors && validation.errors.length > 0) {
    output += '\n  [错误] 必须修复后才能继续:\n';
    validation.errors.forEach(err => {
      output += `    ✗ ${err}\n`;
    });
  }
  
  if (validation.warnings && validation.warnings.length > 0) {
    output += '\n  [警告] 需要注意但可继续:\n';
    validation.warnings.forEach(warn => {
      output += `    ⚠ ${warn}\n`;
    });
  }
  
  if (validation.info && validation.info.length > 0) {
    output += '\n  [信息]\n';
    validation.info.forEach(info => {
      output += `    ℹ ${info}\n`;
    });
  }
  
  if (validation.errors && validation.errors.length === 0) {
    output += '\n  ✓ 检查通过\n';
  }
  
  return output;
}

function formatPendingList(pendingItems) {
  let output = printHeader(`待确认操作列表 (${pendingItems.length} 项)`);
  
  if (pendingItems.length === 0) {
    output += '  当前没有待确认的操作。\n';
    return output;
  }
  
  const cols = {
    seq: 4,
    type: 14,
    name: 12,
    company: 18,
    badge: 14,
    detail: 20,
    time: 16
  };
  
  output += pad('序号', cols.seq) + pad('操作类型', cols.type) +
            pad('姓名', cols.name) + pad('公司', cols.company) +
            pad('胸牌编号', cols.badge) + pad('详情', cols.detail) +
            pad('添加时间', cols.time) + '\n';
  output += '-'.repeat(80) + '\n';
  
  const typeLabels = {
    'reprint': '补打',
    'update_name': '修改姓名',
    'update_company': '修改公司',
    'update_badge': '换编号',
    'update_permission': '改权限',
    'checkin': '签到'
  };
  
  pendingItems.forEach((item, idx) => {
    let detail = '';
    if (item.operationType === 'reprint') {
      detail = item.reprintReason || '补打';
    } else if (item.oldValue && item.newValue) {
      detail = `${item.oldValue} → ${item.newValue}`;
    }
    
    output += 
      pad(String(idx + 1), cols.seq) +
      pad(typeLabels[item.operationType] || item.operationType, cols.type) +
      pad(item.name || '-', cols.name) +
      pad((item.company || '-').substring(0, 16), cols.company) +
      pad(item.badgeNumber || '-', cols.badge) +
      pad(detail.substring(0, 18), cols.detail) +
      pad(formatTimestamp(item.addedAt).substring(5, 21), cols.time) +
      '\n';
  });
  
  output += '\n  提示: 使用 "badge confirm" 确认以上操作后将生成打印批次。\n';
  
  return output;
}

function formatAttendeeInfo(attendee) {
  let output = printHeader(`参会人详情 - ${attendee.name}`);
  
  output += `\n  基本信息:\n`;
  output += `    胸牌编号: ${attendee.badgeNumber}\n`;
  output += `    姓名:     ${attendee.name}\n`;
  output += `    公司:     ${attendee.company}\n`;
  output += `    嘉宾类型: ${attendee.guestType}\n`;
  output += `    签到状态: ${attendee.checkinStatus}\n`;
  output += `    权限区域: ${attendee.permissionZone || '(未设置)'}\n`;
  output += `    联系电话: ${attendee.phone || '-'}\n`;
  output += `    电子邮箱: ${attendee.email || '-'}\n`;
  
  output += `\n  打印/补打记录:\n`;
  output += `    补打次数: ${attendee.reprintCount || 0} 次\n`;
  
  if (attendee.reprintReasons && attendee.reprintReasons.length > 0) {
    attendee.reprintReasons.forEach((r, i) => {
      output += `    ${i + 1}. ${r.reason} (${formatTimestamp(r.timestamp)})\n`;
    });
  }
  
  output += `\n  系统信息:\n`;
  output += `    创建时间: ${formatTimestamp(attendee.createdAt)}\n`;
  output += `    最后更新: ${formatTimestamp(attendee.updatedAt)}\n`;
  
  return output;
}

function formatSummary(stats) {
  let output = printHeader('系统数据概览');
  
  output += `\n  参会人数据:\n`;
  output += `    总人数: ${stats.totalAttendees}\n`;
  output += `    已签到: ${stats.checkedIn}\n`;
  output += `    未签到: ${stats.notCheckedIn}\n`;
  
  output += `\n  嘉宾类型分布:\n`;
  Object.entries(stats.byType).forEach(([type, count]) => {
    output += `    ${type}: ${count} 人\n`;
  });
  
  output += `\n  打印/补打统计:\n`;
  output += `    总打印次数: ${stats.totalPrints}\n`;
  output += `    补打次数: ${stats.totalReprints}\n`;
  output += `    有补打记录: ${stats.hasReprint} 人\n`;
  
  if (stats.pendingCount > 0) {
    output += `\n  待处理:\n`;
    output += `    待确认操作: ${stats.pendingCount} 项\n`;
  }
  
  return output;
}

function formatExportCSV(data, type) {
  if (data.length === 0) return '';
  
  const headers = {
    attendees: ['胸牌编号', '姓名', '公司', '嘉宾类型', '权限区域', '签到状态', '补打次数', '联系电话'],
    history: ['批次号', '操作时间', '操作类型', '胸牌编号', '姓名', '公司', '详情'],
    printList: ['序号', '胸牌编号', '姓名', '公司', '嘉宾类型', '权限区域', '签到状态']
  };
  
  let csv = headers[type] ? headers[type].join(',') : Object.keys(data[0]).join(',');
  csv += '\n';
  
  data.forEach(item => {
    if (type === 'attendees') {
      csv += [
        item.badgeNumber,
        item.name,
        item.company,
        item.guestType,
        item.permissionZone,
        item.checkinStatus,
        item.reprintCount || 0,
        item.phone
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    } else if (type === 'printList') {
      const attendee = item.attendee || item;
      csv += [
        item.seq || '',
        attendee.badgeNumber,
        attendee.name,
        attendee.company,
        attendee.guestType,
        attendee.permissionZone,
        attendee.checkinStatus
      ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',') + '\n';
    } else {
      Object.values(item).forEach(v => {
        csv += `"${String(v || '').replace(/"/g, '""')}",`;
      });
      csv = csv.slice(0, -1) + '\n';
    }
  });
  
  return csv;
}

module.exports = {
  formatTimestamp,
  printHeader,
  formatPrintList,
  formatReprintHistory,
  formatValidationReport,
  formatPendingList,
  formatAttendeeInfo,
  formatSummary,
  formatExportCSV
};
