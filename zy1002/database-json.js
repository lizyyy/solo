const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'data.json');

let db = {
  employees: [],
  shifts: [
    { id: 1, name: '早班', start_time: '08:00', end_time: '16:00', type: 'morning' },
    { id: 2, name: '晚班', start_time: '16:00', end_time: '24:00', type: 'evening' }
  ],
  schedules: [],
  shiftExchanges: [],
  auditLogs: []
};

let nextIds = {
  employees: 1,
  schedules: 1,
  shiftExchanges: 1,
  auditLogs: 1
};

function loadDatabase() {
  if (fs.existsSync(dbPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      db = { ...db, ...data };
      
      if (db.employees.length > 0) {
        nextIds.employees = Math.max(...db.employees.map(e => e.id)) + 1;
      }
      if (db.schedules.length > 0) {
        nextIds.schedules = Math.max(...db.schedules.map(s => s.id)) + 1;
      }
      if (db.shiftExchanges.length > 0) {
        nextIds.shiftExchanges = Math.max(...db.shiftExchanges.map(e => e.id)) + 1;
      }
    } catch (error) {
      console.error('加载数据库失败:', error);
    }
  }
}

function saveDatabase() {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

function getCurrentTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

loadDatabase();

module.exports = {
  prepare: function(sql) {
    const sqlTrim = sql.trim().toLowerCase();
    
    if (sqlTrim.startsWith('select * from employees order by id')) {
      return {
        all: function() {
          return db.employees.sort((a, b) => a.id - b.id);
        },
        get: function() {
          return db.employees.sort((a, b) => a.id - b.id)[0];
        }
      };
    }

    if (sqlTrim.startsWith('select * from shifts order by id')) {
      return {
        all: function() {
          return db.shifts.sort((a, b) => a.id - b.id);
        }
      };
    }

    if (sqlTrim.startsWith('select * from employees')) {
      if (sql.includes('WHERE name = ?')) {
        return {
          get: function(name) {
            return db.employees.find(e => e.name === name);
          }
        };
      }
      if (sql.includes('WHERE id = ?')) {
        return {
          get: function(id) {
            return db.employees.find(e => e.id === id);
          }
        };
      }
      if (sql.includes('WHERE name = ? AND id != ?')) {
        return {
          get: function(name, id) {
            return db.employees.find(e => e.name === name && e.id !== id);
          }
        };
      }
    }

    if (sqlTrim.startsWith('select count(*) as count from employees')) {
      return {
        get: function() {
          return { count: db.employees.length };
        }
      };
    }

    if (sqlTrim.startsWith('select count(*) as count from schedules')) {
      if (sql.includes('WHERE employee_id = ?')) {
        return {
          get: function(employeeId) {
            return { count: db.schedules.filter(s => s.employee_id === employeeId).length };
          }
        };
      }
    }

    if (sqlTrim.startsWith('select count(*) as count from shifts')) {
      return {
        get: function() {
          return { count: db.shifts.length };
        }
      };
    }

    if (sqlTrim.startsWith('insert into employees')) {
      return {
        run: function(name, phone, email) {
          const employee = {
            id: nextIds.employees++,
            name: name,
            phone: phone || null,
            email: email || null,
            created_at: getCurrentTimestamp()
          };
          db.employees.push(employee);
          saveDatabase();
          return { lastInsertRowid: employee.id };
        }
      };
    }

    if (sqlTrim.startsWith('update employees')) {
      return {
        run: function(name, phone, email, id) {
          const index = db.employees.findIndex(e => e.id === id);
          if (index !== -1) {
            db.employees[index] = {
              ...db.employees[index],
              name: name,
              phone: phone || null,
              email: email || null
            };
            saveDatabase();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    if (sqlTrim.startsWith('delete from employees')) {
      return {
        run: function(id) {
          const index = db.employees.findIndex(e => e.id === id);
          if (index !== -1) {
            db.employees.splice(index, 1);
            saveDatabase();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    if (sqlTrim.startsWith('select s.*, e.name as employee_name, sh.name as shift_name, sh.type as shift_type')) {
      return {
        all: function(...params) {
          let result = db.schedules.map(s => {
            const employee = db.employees.find(e => e.id === s.employee_id);
            const shift = db.shifts.find(sh => sh.id === s.shift_id);
            return {
              ...s,
              employee_name: employee ? employee.name : null,
              shift_name: shift ? shift.name : null,
              shift_type: shift ? shift.type : null,
              start_time: shift ? shift.start_time : null,
              end_time: shift ? shift.end_time : null
            };
          });

          if (params.length >= 2) {
            const startDate = params[0];
            const endDate = params[1];
            result = result.filter(s => s.date >= startDate && s.date <= endDate);
          }

          result.sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.shift_id - b.shift_id;
          });

          return result;
        }
      };
    }

    if (sqlTrim.startsWith('select * from schedules')) {
      if (sql.includes('WHERE date = ? AND shift_id = ? AND employee_id = ?')) {
        return {
          get: function(date, shiftId, employeeId) {
            return db.schedules.find(s => 
              s.date === date && s.shift_id === shiftId && s.employee_id === employeeId
            );
          }
        };
      }
      if (sql.includes('WHERE id = ?')) {
        return {
          get: function(id) {
            return db.schedules.find(s => s.id === id);
          }
        };
      }
    }

    if (sqlTrim.startsWith('insert into schedules')) {
      return {
        run: function(date, shiftId, employeeId) {
          const schedule = {
            id: nextIds.schedules++,
            date: date,
            shift_id: shiftId,
            employee_id: employeeId,
            created_at: getCurrentTimestamp()
          };
          db.schedules.push(schedule);
          saveDatabase();
          return { lastInsertRowid: schedule.id };
        }
      };
    }

    if (sqlTrim.startsWith('delete from schedules')) {
      return {
        run: function(id) {
          const index = db.schedules.findIndex(s => s.id === id);
          if (index !== -1) {
            db.schedules.splice(index, 1);
            saveDatabase();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    if (sqlTrim.startsWith('select se.*, e1.name as from_employee_name, e2.name as to_employee_name')) {
      return {
        all: function(...params) {
          let result = db.shiftExchanges.map(ex => {
            const fromEmployee = db.employees.find(e => e.id === ex.from_employee_id);
            const toEmployee = db.employees.find(e => e.id === ex.to_employee_id);
            const shift = db.shifts.find(sh => sh.id === ex.shift_id);
            return {
              ...ex,
              from_employee_name: fromEmployee ? fromEmployee.name : null,
              to_employee_name: toEmployee ? toEmployee.name : null,
              shift_name: shift ? shift.name : null
            };
          });

          const statusParam = params.findIndex(p => typeof p === 'string' && ['pending', 'approved', 'rejected'].includes(p));
          if (statusParam !== -1) {
            result = result.filter(ex => ex.status === params[statusParam]);
          }

          const employeeParam = params.findIndex(p => typeof p === 'number');
          if (employeeParam !== -1) {
            const empId = params[employeeParam];
            result = result.filter(ex => 
              ex.from_employee_id === empId || ex.to_employee_id === empId
            );
          }

          result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

          return result;
        }
      };
    }

    if (sqlTrim.startsWith('select * from shift_exchanges')) {
      if (sql.includes('WHERE id = ?')) {
        return {
          get: function(id) {
            return db.shiftExchanges.find(ex => ex.id === id);
          }
        };
      }
      if (sql.includes('WHERE schedule_id = ? AND status =')) {
        return {
          get: function(scheduleId) {
            return db.shiftExchanges.find(ex => 
              ex.schedule_id === scheduleId && ex.status === 'pending'
            );
          },
          all: function(scheduleId) {
            return db.shiftExchanges.filter(ex => 
              ex.schedule_id === scheduleId && ex.status === 'pending'
            );
          }
        };
      }
    }

    if (sqlTrim.startsWith('insert into shift_exchanges')) {
      return {
        run: function(fromEmployeeId, toEmployeeId, scheduleId, date, shiftId, reason) {
          const exchange = {
            id: nextIds.shiftExchanges++,
            from_employee_id: fromEmployeeId,
            to_employee_id: toEmployeeId,
            schedule_id: scheduleId,
            date: date,
            shift_id: shiftId,
            status: 'pending',
            reason: reason || null,
            created_at: getCurrentTimestamp(),
            processed_at: null,
            processed_by: null
          };
          db.shiftExchanges.push(exchange);
          saveDatabase();
          return { lastInsertRowid: exchange.id };
        }
      };
    }

    if (sqlTrim.startsWith('update schedules set employee_id')) {
      return {
        run: function(toEmployeeId, scheduleId) {
          const index = db.schedules.findIndex(s => s.id === scheduleId);
          if (index !== -1) {
            db.schedules[index].employee_id = toEmployeeId;
            saveDatabase();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    if (sqlTrim.startsWith('update shift_exchanges set status')) {
      return {
        run: function(status, processedBy, id) {
          const index = db.shiftExchanges.findIndex(ex => ex.id === id);
          if (index !== -1) {
            db.shiftExchanges[index].status = status;
            db.shiftExchanges[index].processed_at = getCurrentTimestamp();
            db.shiftExchanges[index].processed_by = processedBy;
            saveDatabase();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    if (sqlTrim.startsWith('update shift_exchanges set status = \'rejected\'')) {
      return {
        run: function(status, processedAt, processedBy, reason, id) {
          const index = db.shiftExchanges.findIndex(ex => ex.id === id);
          if (index !== -1) {
            db.shiftExchanges[index].status = 'rejected';
            db.shiftExchanges[index].processed_at = getCurrentTimestamp();
            db.shiftExchanges[index].processed_by = processedBy;
            if (reason) {
              db.shiftExchanges[index].reason = reason;
            }
            saveDatabase();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }

    return {
      all: () => [],
      get: () => null,
      run: () => ({ changes: 0, lastInsertRowid: 0 })
    };
  },

  transaction: function(fn) {
    return function(...args) {
      return fn(...args);
    };
  },

  exec: function(sql) {
    saveDatabase();
  }
};
