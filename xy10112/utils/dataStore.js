const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

const FILES = {
  members: path.join(DATA_DIR, 'members.json'),
  records: path.join(DATA_DIR, 'records.json'),
  history: path.join(DATA_DIR, 'history.json')
};

function readData(fileKey) {
  const filePath = FILES[fileKey];
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`读取${fileKey}数据失败:`, err);
    return [];
  }
}

function writeData(fileKey, data) {
  const filePath = FILES[fileKey];
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`写入${fileKey}数据失败:`, err);
    return false;
  }
}

function getMembers() {
  return readData('members');
}

function addMember(member) {
  const members = getMembers();
  const exists = members.find(m => m.phone === member.phone);
  if (exists) {
    return { success: false, message: '该手机号已存在' };
  }
  member.id = Date.now().toString();
  member.createdAt = new Date().toISOString();
  members.push(member);
  writeData('members', members);
  return { success: true, member };
}

function findMemberByPhone(phone) {
  const members = getMembers();
  return members.find(m => m.phone === phone);
}

function getRecords() {
  return readData('records');
}

function addRecords(records, importedFileName) {
  const existingRecords = getRecords();
  const history = readData('history');
  const errors = [];
  const duplicates = [];
  const successRecords = [];
  
  const importId = Date.now().toString();
  
  records.forEach((record, index) => {
    const requiredFields = ['phone', 'name', 'amount', 'date'];
    const missingFields = requiredFields.filter(f => !record[f]);
    
    if (missingFields.length > 0) {
      errors.push({
        row: index + 2,
        message: `缺少必要字段: ${missingFields.join(', ')}`,
        record
      });
      return;
    }
    
    const phone = record.phone.toString().trim();
    const date = record.date.trim();
    const amount = parseFloat(record.amount);
    
    const isDuplicate = existingRecords.some(
      r => r.phone === phone && r.date === date && Math.abs(parseFloat(r.amount) - amount) < 0.01 && r.status !== 'rejected'
    );
    
    if (isDuplicate) {
      duplicates.push({
        row: index + 2,
        record: { ...record, phone, date, amount }
      });
      return;
    }
    
    const member = findMemberByPhone(phone);
    
    const newRecord = {
      id: `${importId}-${index}`,
      importId,
      phone,
      name: record.name.trim(),
      amount,
      date,
      note: record.note ? record.note.trim() : '',
      memberName: member ? member.name : '',
      status: 'pending',
      importedFrom: importedFileName,
      importedAt: new Date().toISOString()
    };
    
    successRecords.push(newRecord);
    existingRecords.push(newRecord);
  });
  
  writeData('records', existingRecords);
  
  const historyItem = {
    id: importId,
    fileName: importedFileName,
    importedAt: new Date().toISOString(),
    totalCount: records.length,
    successCount: successRecords.length,
    errorCount: errors.length,
    duplicateCount: duplicates.length,
    status: 'pending'
  };
  
  history.push(historyItem);
  writeData('history', history);
  
  return {
    success: errors.length === 0 && duplicates.length === 0,
    importId,
    successCount: successRecords.length,
    errorCount: errors.length,
    duplicateCount: duplicates.length,
    errors,
    duplicates,
    records: successRecords
  };
}

function updateRecordStatus(recordId, status) {
  const records = getRecords();
  const index = records.findIndex(r => r.id === recordId);
  
  if (index === -1) {
    return { success: false, message: '记录不存在' };
  }
  
  if (!['approved', 'rejected'].includes(status)) {
    return { success: false, message: '无效的状态值' };
  }
  
  records[index].status = status;
  records[index].reviewedAt = new Date().toISOString();
  
  writeData('records', records);
  
  return { success: true, record: records[index] };
}

function batchUpdateStatus(recordIds, status) {
  const results = [];
  for (const id of recordIds) {
    results.push(updateRecordStatus(id, status));
  }
  return results;
}

function getRecordsByImportId(importId) {
  const records = getRecords();
  return records.filter(r => r.importId === importId);
}

function getHistory() {
  const history = readData('history');
  return history.sort((a, b) => new Date(b.importedAt) - new Date(a.importedAt));
}

function getExportableRecords(statuses = ['approved']) {
  const records = getRecords();
  return records.filter(r => statuses.includes(r.status));
}

module.exports = {
  getMembers,
  addMember,
  findMemberByPhone,
  getRecords,
  addRecords,
  updateRecordStatus,
  batchUpdateStatus,
  getRecordsByImportId,
  getHistory,
  getExportableRecords
};
