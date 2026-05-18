function generateReminderList(validationResults, referenceDate = new Date()) {
  const reminderList = [];
  const summary = {
    totalRecords: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    dueSoonCount: 0,
    byDepartment: {},
    byEmployee: {}
  };

  for (const record of validationResults.validRecords) {
    const dueDate = parseDate(record['应归还日期']);
    const actualReturnDate = parseDate(record['实际归还日期']);
    const borrowDate = parseDate(record['借用日期']);

    if (actualReturnDate && actualReturnDate <= referenceDate) {
      continue;
    }

    const overdueInfo = calculateOverdueInfo(dueDate, referenceDate);

    const reminderItem = {
      资产编号: record['资产编号'],
      资产名称: record['资产名称'],
      借用人工号: record['借用人工号'],
      借用人姓名: record['借用人姓名'],
      借用部门: record['借用部门'],
      借用日期: formatDate(borrowDate),
      应归还日期: formatDate(dueDate),
      逾期天数: overdueInfo.days,
      逾期状态: overdueInfo.status,
      资产状态: record['资产状态'],
      来源文件: record._sourceFile
    };

    summary.totalRecords++;

    if (overdueInfo.isOverdue) {
      summary.overdueCount++;
      reminderList.push(reminderItem);
    } else if (overdueInfo.isDueToday) {
      summary.dueTodayCount++;
      reminderList.push(reminderItem);
    } else if (overdueInfo.isDueSoon) {
      summary.dueSoonCount++;
    }

    const dept = record['借用部门'];
    summary.byDepartment[dept] = (summary.byDepartment[dept] || 0) + 1;

    const empKey = `${record['借用人姓名']}(${record['借用人工号']})`;
    summary.byEmployee[empKey] = (summary.byEmployee[empKey] || 0) + 1;
  }

  reminderList.sort((a, b) => b.逾期天数 - a.逾期天数);

  return {
    reminderList,
    summary,
    specialCases: validationResults.specialCases,
    errors: validationResults.errors
  };
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const cleanDate = String(dateStr).trim();
  
  if (cleanDate === '' || cleanDate === '未归还' || cleanDate === 'null') {
    return null;
  }

  try {
    let date;
    if (cleanDate.includes('/')) {
      const parts = cleanDate.split('/');
      if (parts.length === 3) {
        const year = parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2]);
        date = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
    } else if (cleanDate.includes('-')) {
      const parts = cleanDate.split('-');
      if (parts.length === 3) {
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    } else {
      date = new Date(cleanDate);
    }
    
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

function calculateOverdueInfo(dueDate, referenceDate) {
  if (!dueDate) {
    return {
      days: 0,
      status: '日期无效',
      isOverdue: false,
      isDueToday: false,
      isDueSoon: false
    };
  }

  const diffTime = referenceDate.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  let status = '正常';
  let isOverdue = false;
  let isDueToday = false;
  let isDueSoon = false;

  if (diffDays > 0) {
    status = `已逾期 ${diffDays} 天`;
    isOverdue = true;
  } else if (diffDays === 0) {
    status = '今日到期';
    isDueToday = true;
  } else if (diffDays >= -3) {
    status = `即将到期 (${Math.abs(diffDays)} 天后)`;
    isDueSoon = true;
  }

  return {
    days: diffDays,
    status,
    isOverdue,
    isDueToday,
    isDueSoon
  };
}

function formatDate(date) {
  if (!date) return '-';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  generateReminderList,
  parseDate,
  calculateOverdueInfo
};
