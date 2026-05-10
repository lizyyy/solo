const { v4: uuidv4 } = require('uuid');
const storage = require('../models/storage');
const eventBus = require('../utils/eventBus');
const { getTableType } = require('../utils/helpers');
const config = require('../config');

class TableService {
  getAvailableTables(tableType = null) {
    const tables = storage.getTables();
    if (!tableType) {
      return tables;
    }
    return tables.filter(t => t.type === tableType);
  }

  findMatchingTable(partySize, preferCombined = false) {
    const tables = storage.getTables();
    const targetType = getTableType(partySize);
    const typeConfig = config.TABLE_TYPES[targetType];

    let matching = tables.find(t => 
      t.status === 'AVAILABLE' && 
      t.type === targetType && 
      t.capacity >= partySize
    );

    if (matching) {
      return {
        table: matching,
        method: 'direct',
        combined: []
      };
    }

    if (preferCombined) {
      const combination = this._findCombination(partySize, tables);
      if (combination) {
        return {
          table: null,
          method: 'combine',
          combined: combination
        };
      }
    }

    const upgradeOptions = ['SMALL', 'MEDIUM', 'LARGE'];
    const currentIdx = upgradeOptions.indexOf(targetType);
    for (let i = currentIdx + 1; i < upgradeOptions.length; i++) {
      const upgradeType = upgradeOptions[i];
      matching = tables.find(t => 
        t.status === 'AVAILABLE' && 
        t.type === upgradeType && 
        t.capacity >= partySize
      );
      if (matching) {
        return {
          table: matching,
          method: 'upgrade',
          combined: [],
          upgradeFrom: targetType,
          upgradeTo: upgradeType
        };
      }
    }

    return {
      table: null,
      method: 'none',
      combined: [],
      message: '暂无匹配的桌位，请继续等待或选择拼桌'
    };
  }

  _findCombination(partySize, tables) {
    const available = tables.filter(t => t.status === 'AVAILABLE');
    const maxTry = 3;
    
    for (let k = 2; k <= maxTry; k++) {
      const combinations = this._getCombinations(available, k);
      for (const combo of combinations) {
        const totalCapacity = combo.reduce((sum, t) => sum + t.capacity, 0);
        if (totalCapacity >= partySize && totalCapacity <= partySize + 2) {
          return combo;
        }
      }
    }
    return null;
  }

  _getCombinations(arr, k) {
    const result = [];
    const backtrack = (start, current) => {
      if (current.length === k) {
        result.push([...current]);
        return;
      }
      for (let i = start; i < arr.length; i++) {
        current.push(arr[i]);
        backtrack(i + 1, current);
        current.pop();
      }
    };
    backtrack(0, []);
    return result;
  }

  combineTables(tableIds) {
    if (!tableIds || tableIds.length < 2) {
      throw new Error('合桌至少需要2张桌子');
    }

    const tables = storage.getTables();
    const toCombine = tables.filter(t => tableIds.includes(t.id));

    if (toCombine.length !== tableIds.length) {
      throw new Error('部分桌号不存在');
    }

    const available = toCombine.filter(t => t.status === 'AVAILABLE');
    if (available.length !== toCombine.length) {
      throw new Error('只有空闲桌子才能合桌');
    }

    const combinedId = `C_${uuidv4().slice(0, 6)}`;
    const totalCapacity = toCombine.reduce((sum, t) => sum + t.capacity, 0);

    const combinedTable = {
      id: combinedId,
      type: 'COMBINED',
      capacity: totalCapacity,
      status: 'AVAILABLE',
      isCombined: true,
      originalTables: tableIds,
      createdAt: new Date().toISOString()
    };

    toCombine.forEach(t => {
      t.status = 'COMBINED';
      t.parentCombinedId = combinedId;
    });

    tables.push(combinedTable);
    storage.saveTables(tables);

    eventBus.emitEvent('TABLE.COMBINE', {
      combinedTableId: combinedId,
      tables: tableIds,
      totalCapacity,
      timestamp: new Date().toISOString()
    });

    return combinedTable;
  }

  splitTable(combinedTableId) {
    const tables = storage.getTables();
    const combined = tables.find(t => t.id === combinedTableId && t.isCombined);

    if (!combined) {
      throw new Error('未找到该合桌记录');
    }

    if (combined.status === 'OCCUPIED') {
      throw new Error('合桌正在使用中，无法拆分');
    }

    const originalTables = tables.filter(t => combined.originalTables.includes(t.id));
    originalTables.forEach(t => {
      t.status = 'AVAILABLE';
      delete t.parentCombinedId;
    });

    const newTables = tables.filter(t => t.id !== combinedTableId);
    storage.saveTables(newTables);

    eventBus.emitEvent('TABLE.SPLIT', {
      combinedTableId,
      tables: combined.originalTables,
      timestamp: new Date().toISOString()
    });

    return { success: true, restoredTables: originalTables };
  }

  releaseTable(tableId) {
    const tables = storage.getTables();
    const table = tables.find(t => t.id === tableId);

    if (!table) {
      throw new Error('未找到该桌号');
    }

    if (table.isCombined) {
      return this.splitTable(tableId);
    }

    table.status = 'AVAILABLE';
    delete table.currentTicketId;
    storage.saveTables(tables);

    return { success: true, table };
  }

  updateTableStatus(tableId, status) {
    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'];
    if (!validStatuses.includes(status)) {
      throw new Error(`无效状态，有效值：${validStatuses.join(', ')}`);
    }

    const tables = storage.getTables();
    const table = tables.find(t => t.id === tableId);

    if (!table) {
      throw new Error('未找到该桌号');
    }

    table.status = status;
    storage.saveTables(tables);

    return table;
  }
}

module.exports = new TableService();
