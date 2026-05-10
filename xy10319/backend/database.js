const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'conversion-data.json');

let data = {
  consultants: [],
  courses: [],
  customers: [],
  promotions: [],
  trial_bookings: [],
  attendances: [],
  parent_feedbacks: [],
  follow_ups: [],
  lost_leads: [],
  enrollments: []
};

let nextId = {
  consultants: 1,
  courses: 1,
  customers: 1,
  promotions: 1,
  trial_bookings: 1,
  attendances: 1,
  parent_feedbacks: 1,
  follow_ups: 1,
  lost_leads: 1,
  enrollments: 1
};

const saveData = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dataFile, JSON.stringify({ data, nextId }, null, 2));
};

const loadData = () => {
  if (fs.existsSync(dataFile)) {
    try {
      const fileContent = fs.readFileSync(dataFile, 'utf-8');
      const parsed = JSON.parse(fileContent);
      data = parsed.data;
      nextId = parsed.nextId;
      return true;
    } catch (e) {
      console.error('数据文件解析错误，使用初始数据:', e.message);
    }
  }
  return false;
};

const prepare = (sql) => {
  const tableMatch = sql.match(/FROM\s+(\w+)/i) || sql.match(/INTO\s+(\w+)/i) || sql.match(/UPDATE\s+(\w+)/i);
  const table = tableMatch ? tableMatch[1] : null;

  return {
    all: (...params) => {
      if (!table) return [];
      
      if (sql.includes('SELECT')) {
        return data[table] || [];
      }
      return [];
    },
    get: (...params) => {
      if (!table) return null;
      
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
      let results = data[table] || [];
      
      if (whereMatch) {
        const whereClause = whereMatch[1];
        const idMatch = whereClause.match(/id\s*=\s*\?/);
        if (idMatch && params.length > 0) {
          results = results.filter(row => row.id === params[0]);
        }
      }
      
      return results[0] || null;
    },
    run: (...params) => {
      const result = { lastInsertRowid: null, changes: 0 };
      
      if (!table) return result;
      
      if (sql.includes('INSERT')) {
        const columnsMatch = sql.match(/\(([^)]+)\)/);
        const valuesMatch = sql.match(/VALUES\s*\(([^)]+)\)/i);
        
        if (columnsMatch && valuesMatch) {
          const columns = columnsMatch[1].split(',').map(c => c.trim());
          const values = params;
          
          const newRow = { id: nextId[table]++ };
          columns.forEach((col, index) => {
            newRow[col] = values[index] !== undefined ? values[index] : null;
          });
          
          newRow.created_at = newRow.created_at || dayjs().format('YYYY-MM-DD HH:mm:ss');
          
          data[table].push(newRow);
          result.lastInsertRowid = newRow.id;
          result.changes = 1;
          saveData();
        }
      } else if (sql.includes('UPDATE')) {
        const setMatch = sql.match(/SET\s+(.+?)(?:WHERE|$)/i);
        const whereMatch = sql.match(/WHERE\s+(.+?)(?:ORDER|LIMIT|$)/i);
        
        if (setMatch) {
          const setClauses = setMatch[1].split(',').map(c => c.trim());
          const updates = {};
          
          let paramIndex = 0;
          setClauses.forEach(clause => {
            const [col, val] = clause.split('=').map(s => s.trim());
            if (val === '?') {
              updates[col] = params[paramIndex++];
            } else {
              const incMatch = val.match(/(\w+)\s*\+\s*(\d+)/);
              if (incMatch) {
                updates[col] = updates[col] || 0;
                updates[col] += parseInt(incMatch[2]);
              } else {
                updates[col] = val.replace(/'/g, '');
              }
            }
          });
          
          let updatedCount = 0;
          if (whereMatch) {
            const whereClause = whereMatch[1];
            const idMatch = whereClause.match(/id\s*=\s*\?/);
            
            data[table] = data[table].map(row => {
              let shouldUpdate = false;
              if (idMatch) {
                shouldUpdate = row.id === params[paramIndex];
              } else {
                shouldUpdate = true;
              }
              
              if (shouldUpdate) {
                updatedCount++;
                return { ...row, ...updates };
              }
              return row;
            });
          }
          
          result.changes = updatedCount;
          if (updatedCount > 0) saveData();
        }
      }
      
      return result;
    }
  };
};

const exec = (sql) => {
  saveData();
};

const transaction = (fn) => {
  fn();
  saveData();
};

const seedData = () => {
  if (data.consultants.length > 0) return;

  const insertConsultant = (name, department) => {
    const id = nextId.consultants++;
    data.consultants.push({ id, name, department, created_at: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    return id;
  };

  insertConsultant('张老师', '启蒙部');
  insertConsultant('李老师', '启智部');
  insertConsultant('王老师', '启蒙部');
  insertConsultant('赵老师', '启智部');

  const insertCourse = (name, age_range, description) => {
    const id = nextId.courses++;
    data.courses.push({ id, name, age_range, description, created_at: dayjs().format('YYYY-MM-DD HH:mm:ss') });
    return id;
  };

  insertCourse('亲子启蒙课', '2-3岁', '适合2-3岁幼儿的亲子互动课程');
  insertCourse('感觉统合课', '3-4岁', '培养孩子的感官协调能力');
  insertCourse('思维训练课', '4-5岁', '逻辑思维和问题解决能力培养');
  insertCourse('语言表达课', '3-5岁', '语言表达和社交能力培养');

  const insertPromotion = (name, discount_amount, expire_date, max_count) => {
    const id = nextId.promotions++;
    data.promotions.push({
      id, name, discount_amount, expire_date, max_count,
      used_count: 0, status: 'active',
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertPromotion('新客立减500元', 500, '2025-12-31', 10);
  insertPromotion('试听当天报名减300', 300, '2025-06-01', 5);
  insertPromotion('老带新优惠', 200, '2025-12-31', 20);

  const insertCustomer = (child_name, child_age, parent_name, phone, status) => {
    const id = nextId.customers++;
    data.customers.push({
      id, child_name, child_age, parent_name, phone, status,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertCustomer('小明', 3, '王先生', '13800138001', 'active');
  insertCustomer('小红', 4, '李女士', '13800138002', 'active');
  insertCustomer('小刚', 2, '张先生', '13800138003', 'lost');
  insertCustomer('小美', 5, '陈女士', '13800138004', 'active');
  insertCustomer('小华', 3, '刘先生', '13800138005', 'active');
  insertCustomer('小强', 4, '周女士', '13800138006', 'active');

  const insertBooking = (customer_id, course_id, consultant_id, booking_date, status, notes) => {
    const id = nextId.trial_bookings++;
    data.trial_bookings.push({
      id, customer_id, course_id, consultant_id, booking_date, status, notes,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertBooking(1, 1, 1, '2025-05-01 10:00:00', 'enrolled', '正常报名的案例');
  insertBooking(2, 2, 2, '2025-05-02 14:00:00', 'no_show', '未到课案例');
  insertBooking(3, 1, 3, '2025-04-15 10:00:00', 'lost', '流失后重新激活案例');
  insertBooking(4, 3, 1, '2025-05-03 09:00:00', 'following', '跟进中案例');
  insertBooking(5, 4, 2, '2025-05-04 15:00:00', 'booked', '新预约案例');
  insertBooking(6, 2, 4, '2025-05-05 10:00:00', 'enrolled', '使用过期优惠案例');

  const insertAttendance = (booking_id, check_in_time, notes) => {
    const id = nextId.attendances++;
    data.attendances.push({
      id, booking_id, check_in_time, notes,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertAttendance(1, '2025-05-01 09:55:00', '准时到课');
  insertAttendance(4, '2025-05-03 09:05:00', '迟到5分钟');
  insertAttendance(5, null, '尚未签到');
  insertAttendance(6, '2025-05-05 10:00:00', '准时到课');

  const insertFeedback = (booking_id, satisfaction, feedback_text) => {
    const id = nextId.parent_feedbacks++;
    data.parent_feedbacks.push({
      id, booking_id, satisfaction, feedback_text,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertFeedback(1, 5, '孩子很喜欢，老师很有耐心');
  insertFeedback(4, 4, '课程不错，考虑报名');
  insertFeedback(6, 4, '孩子表现不错');

  const insertFollowUp = (booking_id, consultant_id, follow_up_type, content, next_follow_up_date) => {
    const id = nextId.follow_ups++;
    data.follow_ups.push({
      id, booking_id, consultant_id, follow_up_type, content, next_follow_up_date,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertFollowUp(1, 1, '电话跟进', '试听后电话确认报名意向', '2025-05-02');
  insertFollowUp(1, 1, '微信沟通', '发送课程资料和优惠信息', null);
  insertFollowUp(4, 1, '电话跟进', '介绍课程详情，解答家长疑问', '2025-05-05');
  insertFollowUp(6, 4, '微信沟通', '尝试推荐已过期的优惠活动', null);

  const insertLostLead = (booking_id, lost_reason, lost_date, reactivated_at) => {
    const id = nextId.lost_leads++;
    data.lost_leads.push({
      id, booking_id, lost_reason, lost_date, reactivated_at,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertLostLead(3, '距离太远，不方便接送', '2025-04-20', '2025-05-01');

  const insertEnrollment = (booking_id, promotion_id, enrollment_date, amount, notes) => {
    const id = nextId.enrollments++;
    data.enrollments.push({
      id, booking_id, promotion_id, enrollment_date, amount, notes,
      created_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });
    return id;
  };

  insertEnrollment(1, 1, '2025-05-02', 4500, '正常报名，使用新客优惠');
  insertEnrollment(6, 2, '2025-05-06', 4700, '优惠过期，按原价报名');

  const promotion1 = data.promotions.find(p => p.id === 1);
  if (promotion1) promotion1.used_count = 1;

  saveData();
};

const initDatabase = () => {
  const loaded = loadData();
  if (!loaded) {
    seedData();
  }
};

const db = {
  prepare,
  exec,
  transaction,
  pragma: () => {},
  getData: () => data
};

module.exports = { db, initDatabase, seedData };
