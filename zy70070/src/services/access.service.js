const { db, getNextId, now, runTransaction } = require('../db/database');
const { generateNo } = require('../utils/id-generator');
const HistoryService = require('./history.service');

class AccessService {
  static createCard(studentId, cardNo = null) {
    const existingCard = db.data.access_cards.find(
      c => c.student_id === studentId && c.status === 'active'
    );
    
    if (existingCard) {
      return existingCard;
    }
    
    const finalCardNo = cardNo || generateNo('CARD').substring(5);
    const id = getNextId('access_cards');
    
    const card = {
      id,
      card_no: finalCardNo,
      student_id: studentId,
      card_type: 'dorm',
      authorized_bed_ids: '[]',
      status: 'active',
      issued_at: now(),
      last_sync_at: null,
      created_at: now(),
      updated_at: now()
    };
    
    db.data.access_cards.push(card);
    return card;
  }
  
  static getCardByStudent(studentId) {
    return db.data.access_cards.find(
      c => c.student_id === studentId && c.status === 'active'
    );
  }
  
  static syncAccessAfterTransfer(applicationId, operator = 'system') {
    let result = null;
    
    runTransaction(() => {
      const app = db.data.transfer_applications.find(a => a.id === applicationId);
      if (!app) throw new Error('申请不存在');
      
      let card = db.data.access_cards.find(
        c => c.student_id === app.student_id && c.status === 'active'
      );
      
      if (!card) {
        const cardNo = generateNo('CARD').substring(5);
        const cardId = getNextId('access_cards');
        db.data.access_cards.push({
          id: cardId,
          card_no: cardNo,
          student_id: app.student_id,
          card_type: 'dorm',
          authorized_bed_ids: '[]',
          status: 'active',
          issued_at: now(),
          last_sync_at: null,
          created_at: now(),
          updated_at: now()
        });
        card = db.data.access_cards.find(c => c.id === cardId);
      }
      
      const oldBedIds = JSON.parse(card.authorized_bed_ids || '[]');
      const newBedIds = oldBedIds
        .filter(id => id !== app.original_bed_id)
        .concat(app.target_bed_id);
      
      const uniqueBedIds = [...new Set(newBedIds)];
      
      const cardBefore = { ...card };
      
      card.authorized_bed_ids = JSON.stringify(uniqueBedIds);
      card.last_sync_at = now();
      card.updated_at = now();
      
      const cardAfter = { ...card };
      
      const syncNo = generateNo('SYNC');
      const syncId = getNextId('access_sync_logs');
      
      db.data.access_sync_logs.push({
        id: syncId,
        sync_no: syncNo,
        card_id: card.id,
        student_id: app.student_id,
        old_bed_ids: JSON.stringify([app.original_bed_id]),
        new_bed_ids: JSON.stringify([app.target_bed_id]),
        sync_status: 'success',
        sync_result: `门禁同步成功: 移除床位${app.original_bed_id}, 添加床位${app.target_bed_id}`,
        synced_at: now()
      });
      
      HistoryService.createSnapshot('access_cards', card.id, 'update', cardBefore, cardAfter, operator);
      
      HistoryService.logOperation(
        'ACCESS_SYNC',
        'access_cards',
        card.id,
        operator,
        `门禁同步: 学生${app.student_id}, 移除床位${app.original_bed_id}, 添加床位${app.target_bed_id}`
      );
      
      result = {
        sync_no: syncNo,
        card_id: card.id,
        card_no: card.card_no,
        student_id: app.student_id,
        removed_bed: app.original_bed_id,
        added_bed: app.target_bed_id,
        authorized_beds: uniqueBedIds,
        status: 'success',
        message: '门禁权限同步成功'
      };
    });
    
    return result;
  }
  
  static manualSync(cardId, bedIdsToRemove = [], bedIdsToAdd = [], operator = 'system') {
    let result = null;
    
    runTransaction(() => {
      const card = db.data.access_cards.find(c => c.id === cardId);
      if (!card) throw new Error('门禁卡不存在');
      
      const currentBeds = JSON.parse(card.authorized_bed_ids || '[]');
      
      const newBeds = currentBeds
        .filter(id => !bedIdsToRemove.includes(id))
        .concat(bedIdsToAdd);
      
      const uniqueBeds = [...new Set(newBeds)];
      
      const cardBefore = { ...card };
      
      card.authorized_bed_ids = JSON.stringify(uniqueBeds);
      card.last_sync_at = now();
      card.updated_at = now();
      
      const cardAfter = { ...card };
      
      const syncNo = generateNo('SYNC');
      const syncId = getNextId('access_sync_logs');
      
      db.data.access_sync_logs.push({
        id: syncId,
        sync_no: syncNo,
        card_id: card.id,
        student_id: card.student_id,
        old_bed_ids: JSON.stringify(bedIdsToRemove),
        new_bed_ids: JSON.stringify(bedIdsToAdd),
        sync_status: 'success',
        sync_result: '手动门禁同步',
        synced_at: now()
      });
      
      HistoryService.createSnapshot('access_cards', card.id, 'update', cardBefore, cardAfter, operator);
      
      result = {
        sync_no: syncNo,
        card_id: cardId,
        before: currentBeds,
        after: uniqueBeds,
        status: 'success',
        message: '手动门禁同步成功'
      };
    });
    
    return result;
  }
  
  static getSyncLogs(studentId = null, limit = 50) {
    let logs = [...db.data.access_sync_logs];
    if (studentId) {
      logs = logs.filter(l => l.student_id === studentId);
    }
    
    return logs
      .sort((a, b) => b.synced_at.localeCompare(a.synced_at))
      .slice(0, limit)
      .map(log => {
        const card = db.data.access_cards.find(c => c.id === log.card_id);
        const student = db.data.students.find(s => s.id === log.student_id);
        return {
          ...log,
          card_no: card?.card_no,
          student_name: student?.name,
          student_no: student?.student_no,
          old_bed_ids: JSON.parse(log.old_bed_ids || '[]'),
          new_bed_ids: JSON.parse(log.new_bed_ids || '[]')
        };
      });
  }
}

module.exports = AccessService;