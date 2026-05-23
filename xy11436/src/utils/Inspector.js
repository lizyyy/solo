const { Conflict, CONFLICT_TYPES, SOURCE_TYPES } = require('../models/Task');

class Inspector {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  runCheck(date = null, operator = 'system') {
    const data = this.dataStore.load();
    const tasks = date 
      ? data.tasks.filter(t => t.date === date)
      : data.tasks.filter(t => !t.isFrozen);
    
    const results = {
      checked: tasks.length,
      conflicts: [],
      byType: {}
    };

    Object.values(CONFLICT_TYPES).forEach(type => {
      results.byType[type] = [];
    });

    const duplicateConflicts = this.checkDuplicateTasks(tasks);
    results.conflicts.push(...duplicateConflicts);
    results.byType[CONFLICT_TYPES.DUPLICATE] = duplicateConflicts;

    const overlapConflicts = this.checkOverlappingCleanings(tasks);
    results.conflicts.push(...overlapConflicts);
    results.byType[CONFLICT_TYPES.OVERLAP] = overlapConflicts;

    const linenConflicts = this.checkLinenChangeConflicts(tasks);
    results.conflicts.push(...linenConflicts);
    results.byType[CONFLICT_TYPES.LINEN_CHANGE] = linenConflicts;

    const earlyCheckoutConflicts = this.checkEarlyCheckoutConflicts(tasks);
    results.conflicts.push(...earlyCheckoutConflicts);
    results.byType[CONFLICT_TYPES.EARLY_CHECKOUT] = earlyCheckoutConflicts;

    tasks.forEach(task => {
      const taskConflicts = results.conflicts.filter(c => 
        c.affectedTasks.includes(task.id)
      );
      taskConflicts.forEach(conflict => {
        if (!task.conflicts.find(c => c.id === conflict.id)) {
          task.conflicts.push(conflict);
        }
      });
      if (taskConflicts.length > 0 && task.status !== 'failed') {
        task.status = 'failed';
        task.auditTrail.push({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          operator,
          reason: `detected_${taskConflicts.length}_conflicts`
        });
      }
    });

    this.dataStore.save(data);
    this.dataStore.saveSnapshot(operator, `inspection_${date || 'all'}`);

    return results;
  }

  checkDuplicateTasks(tasks) {
    const conflicts = [];
    const taskMap = new Map();

    tasks.forEach(task => {
      const key = `${task.roomNumber}-${task.date}-${task.type}`;
      if (!taskMap.has(key)) {
        taskMap.set(key, []);
      }
      taskMap.get(key).push(task);
    });

    taskMap.forEach((taskGroup, key) => {
      if (taskGroup.length > 1) {
        const sources = taskGroup.map(t => t.sourceEvidences.map(e => 
          `${e.fileName}:${e.lineNumber}`
        ).join(', ')).join('; ');

        const conflict = new Conflict(
          CONFLICT_TYPES.DUPLICATE,
          `房间${key}存在${taskGroup.length}条重复任务`,
          taskGroup.map(t => t.id),
          taskGroup.map(t => ({
            taskId: t.id,
            sources: t.sourceEvidences.map(e => ({
              fileName: e.fileName,
              lineNumber: e.lineNumber,
              sourceType: e.sourceType
            }))
          }))
        );
        conflicts.push(conflict);
      }
    });

    return conflicts;
  }

  checkOverlappingCleanings(tasks) {
    const conflicts = [];
    const byRoomAndDate = new Map();

    tasks.forEach(task => {
      const key = `${task.roomNumber}-${task.date}`;
      if (!byRoomAndDate.has(key)) {
        byRoomAndDate.set(key, []);
      }
      byRoomAndDate.get(key).push(task);
    });

    byRoomAndDate.forEach((taskGroup, key) => {
      if (taskGroup.length > 1) {
        const types = taskGroup.map(t => t.type).join(', ');
        const hasOrderCalendar = taskGroup.some(t => 
          t.sourceEvidences.some(e => e.sourceType === SOURCE_TYPES.ORDER_CALENDAR)
        );
        const hasGroupMessage = taskGroup.some(t => 
          t.sourceEvidences.some(e => e.sourceType === SOURCE_TYPES.CLEANING_GROUP)
        );

        if (hasOrderCalendar && hasGroupMessage) {
          const conflict = new Conflict(
            CONFLICT_TYPES.OVERLAP,
            `房间${key}多源数据重叠: ${types}`,
            taskGroup.map(t => t.id),
            taskGroup.map(t => ({
              taskId: t.id,
              type: t.type,
              sources: t.sourceEvidences.map(e => ({
                fileName: e.fileName,
                lineNumber: e.lineNumber,
                sourceType: e.sourceType
              }))
            }))
          );
          conflicts.push(conflict);
        }
      }
    });

    return conflicts;
  }

  checkLinenChangeConflicts(tasks) {
    const conflicts = [];
    const byRoom = new Map();

    tasks.forEach(task => {
      if (!byRoom.has(task.roomNumber)) {
        byRoom.set(task.roomNumber, []);
      }
      byRoom.get(task.roomNumber).push(task);
    });

    byRoom.forEach((roomTasks, roomNumber) => {
      const sortedTasks = roomTasks.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );

      for (let i = 1; i < sortedTasks.length; i++) {
        const prevTask = sortedTasks[i - 1];
        const currTask = sortedTasks[i];
        
        const prevDate = new Date(prevTask.date);
        const currDate = new Date(currTask.date);
        const daysDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (daysDiff === 0) {
          continue;
        }

        if (daysDiff <= 1 && currTask.needLinenChange === false) {
          const prevHasLinen = prevTask.sourceEvidences.some(e => 
            e.parsedValue && e.parsedValue.needLinenChange === true
          );
          
          if (prevHasLinen === false) {
            const conflict = new Conflict(
              CONFLICT_TYPES.LINEN_CHANGE,
              `房间${roomNumber}连住期间未换布草: ${prevTask.date} - ${currTask.date}`,
              [prevTask.id, currTask.id],
              [
                { taskId: prevTask.id, date: prevTask.date, linen: prevTask.needLinenChange },
                { taskId: currTask.id, date: currTask.date, linen: currTask.needLinenChange }
              ]
            );
            conflicts.push(conflict);
          }
        }
      }
    });

    return conflicts;
  }

  checkEarlyCheckoutConflicts(tasks) {
    const conflicts = [];
    
    const orderTasks = tasks.filter(t => 
      t.sourceEvidences.some(e => e.sourceType === SOURCE_TYPES.ORDER_CALENDAR)
    );

    orderTasks.forEach(orderTask => {
      const hasScanVerification = tasks.some(t =>
        t.roomNumber === orderTask.roomNumber &&
        t.date === orderTask.date &&
        t.sourceEvidences.some(e => e.sourceType === SOURCE_TYPES.SCAN_DETAIL)
      );

      const checkInDate = orderTask.checkInDate ? new Date(orderTask.checkInDate) : null;
      const checkOutDate = orderTask.checkOutDate ? new Date(orderTask.checkOutDate) : null;
      
      if (checkInDate && checkOutDate) {
        const stayDays = Math.floor((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        
        if (stayDays < 1 && !hasScanVerification) {
          const conflict = new Conflict(
            CONFLICT_TYPES.EARLY_CHECKOUT,
            `房间${orderTask.roomNumber}(${orderTask.date})疑似临时退房，无扫码验证`,
            [orderTask.id],
            [{
              taskId: orderTask.id,
              checkIn: orderTask.checkInDate,
              checkOut: orderTask.checkOutDate,
              stayDays,
              hasScanVerification
            }]
          );
          conflicts.push(conflict);
        }
      }
    });

    return conflicts;
  }

  checkMissingRooms(tasks, expectedRooms, date) {
    const actualRooms = new Set(
      tasks.filter(t => t.date === date).map(t => t.roomNumber)
    );
    
    const missing = expectedRooms.filter(r => !actualRooms.has(r));
    
    if (missing.length > 0) {
      return [new Conflict(
        CONFLICT_TYPES.MISSING_ROOM,
        `日期${date}漏房${missing.length}间: ${missing.join(', ')}`,
        [],
        { date, expected: expectedRooms, missing, actual: Array.from(actualRooms) }
      )];
    }
    
    return [];
  }

  getStatistics(date = null) {
    const data = this.dataStore.load();
    const tasks = date 
      ? data.tasks.filter(t => t.date === date)
      : data.tasks;

    const stats = {
      total: tasks.length,
      byStatus: {},
      byType: {},
      bySource: {},
      conflicts: 0,
      resolvedConflicts: 0,
      frozen: tasks.filter(t => t.isFrozen).length
    };

    tasks.forEach(task => {
      stats.byStatus[task.status] = (stats.byStatus[task.status] || 0) + 1;
      stats.byType[task.type] = (stats.byType[task.type] || 0) + 1;
      
      task.sourceEvidences.forEach(e => {
        stats.bySource[e.sourceType] = (stats.bySource[e.sourceType] || 0) + 1;
      });

      task.conflicts.forEach(c => {
        stats.conflicts++;
        if (c.resolved) {
          stats.resolvedConflicts++;
        }
      });
    });

    return stats;
  }
}

module.exports = { Inspector };
