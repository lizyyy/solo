const db = require('../database');

class ConflictChecker {
  constructor() {}

  async checkAllConflicts(contractData) {
    const conflicts = [];
    const warnings = [];
    
    const exclusivityConflicts = await this.checkExclusivity(contractData);
    conflicts.push(...exclusivityConflicts);
    
    const frequencyConflicts = await this.checkFrequency(contractData);
    conflicts.push(...frequencyConflicts);
    
    const inventoryConflicts = await this.checkInventory(contractData);
    conflicts.push(...inventoryConflicts);
    
    const makegoodConflicts = await this.checkMakegoodConflicts(contractData);
    conflicts.push(...makegoodConflicts);
    
    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts,
      warnings: warnings
    };
  }

  checkExclusivity(contractData) {
    return new Promise((resolve, reject) => {
      const conflicts = [];
      const { sponsor_id, category, episode_ids } = contractData;
      
      const placeholders = episode_ids.map(() => '?').join(',');
      const query = `
        SELECT 
          s.id as sponsor_id,
          s.name as sponsor_name,
          s.category as sponsor_category,
          e.episode_number,
          e.title as episode_title
        FROM ad_slots a
        JOIN sponsors s ON a.sponsor_id = s.id
        JOIN episodes e ON a.episode_id = e.id
        WHERE a.episode_id IN (${placeholders})
        AND s.category = ?
        AND s.id != ?
      `;
      
      db.all(query, [...episode_ids, category, sponsor_id], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        if (rows.length > 0) {
          rows.forEach(row => {
            conflicts.push({
              type: 'exclusivity',
              severity: 'high',
              message: `品类排他冲突：节目期数 ${row.episode_number} (${row.episode_title}) 已存在同品类赞助商 ${row.sponsor_name}`,
              details: {
                episode_number: row.episode_number,
                existing_sponsor: row.sponsor_name,
                category: row.sponsor_category
              }
            });
          });
        }
        
        resolve(conflicts);
      });
    });
  }

  checkFrequency(contractData) {
    return new Promise((resolve, reject) => {
      const conflicts = [];
      const { sponsor_id, episode_ids, max_frequency = 2 } = contractData;
      
      const placeholders = episode_ids.map(() => '?').join(',');
      const query = `
        SELECT 
          e.episode_number,
          e.title as episode_title,
          COUNT(a.id) as slot_count
        FROM ad_slots a
        JOIN episodes e ON a.episode_id = e.id
        WHERE a.episode_id IN (${placeholders})
        AND a.sponsor_id = ?
        GROUP BY e.id
        HAVING slot_count >= ?
      `;
      
      db.all(query, [...episode_ids, sponsor_id, max_frequency], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        if (rows.length > 0) {
          rows.forEach(row => {
            conflicts.push({
              type: 'frequency',
              severity: 'medium',
              message: `频次过高：节目期数 ${row.episode_number} (${row.episode_title}) 已安排 ${row.slot_count} 个广告位，接近上限 ${max_frequency}`,
              details: {
                episode_number: row.episode_number,
                current_count: row.slot_count,
                max_allowed: max_frequency
              }
            });
          });
        }
        
        resolve(conflicts);
      });
    });
  }

  checkInventory(contractData) {
    return new Promise((resolve, reject) => {
      const conflicts = [];
      const { episode_ids } = contractData;
      
      const placeholders = episode_ids.map(() => '?').join(',');
      const query = `
        SELECT 
          e.id,
          e.episode_number,
          e.title as episode_title,
          e.inventory,
          COUNT(a.id) as used_slots
        FROM episodes e
        LEFT JOIN ad_slots a ON e.id = a.episode_id
        WHERE e.id IN (${placeholders})
        GROUP BY e.id
        HAVING COUNT(a.id) >= e.inventory
      `;
      
      db.all(query, [...episode_ids], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        if (rows.length > 0) {
          rows.forEach(row => {
            conflicts.push({
              type: 'inventory',
              severity: 'high',
              message: `库存超卖：节目期数 ${row.episode_number} (${row.episode_title}) 库存 ${row.inventory} 已全部售罄`,
              details: {
                episode_number: row.episode_number,
                inventory: row.inventory,
                used: row.used_slots
              }
            });
          });
        }
        
        resolve(conflicts);
      });
    });
  }

  checkMakegoodConflicts(contractData) {
    return new Promise((resolve, reject) => {
      const conflicts = [];
      const { sponsor_id, episode_ids, is_makegood = false } = contractData;
      
      if (!is_makegood) {
        return resolve(conflicts);
      }
      
      const placeholders = episode_ids.map(() => '?').join(',');
      const query = `
        SELECT 
          e.episode_number,
          e.title as episode_title,
          a.id as existing_makegood_id,
          s.name as sponsor_name
        FROM ad_slots a
        JOIN sponsors s ON a.sponsor_id = s.id
        JOIN episodes e ON a.episode_id = e.id
        WHERE a.episode_id IN (${placeholders})
        AND a.is_broadcast = 0
        AND a.is_fulfilled = 0
        AND a.sponsor_id = ?
      `;
      
      db.all(query, [...episode_ids, sponsor_id], (err, rows) => {
        if (err) {
          return reject(err);
        }
        
        if (rows.length > 0) {
          rows.forEach(row => {
            conflicts.push({
              type: 'makegood',
              severity: 'medium',
              message: `补播冲突：节目期数 ${row.episode_number} (${row.episode_title}) 已存在未履行的补播承诺`,
              details: {
                episode_number: row.episode_number,
                existing_makegood_id: row.existing_makegood_id
              }
            });
          });
        }
        
        resolve(conflicts);
      });
    });
  }

  checkContractImport(contract) {
    return this.checkAllConflicts({
      sponsor_id: contract.sponsor_id,
      category: contract.category,
      episode_ids: contract.episode_ids || [],
      max_frequency: contract.max_frequency || 2,
      is_makegood: false
    });
  }
}

module.exports = new ConflictChecker();
