const { v4: uuidv4 } = require('uuid');

const store = {
  customers: [],
  doctors: [],
  services: [],
  customerPackages: [],
  appointments: [],
  transactions: [],
  giftedTransactions: []
};

const now = () => new Date().toISOString();

const initDb = async () => {
  store.services = [
    { id: 'svc_skin_001', name: '深层清洁护理', category: '皮肤管理', unit_price: 380, duration_minutes: 60, description: '深层清洁毛孔，去除老化角质' },
    { id: 'svc_skin_002', name: '水光针护理', category: '皮肤管理', unit_price: 1280, duration_minutes: 45, description: '玻尿酸补水，提亮肤色' },
    { id: 'svc_skin_003', name: '黄金微针', category: '皮肤管理', unit_price: 2580, duration_minutes: 90, description: '刺激胶原蛋白再生' },
    { id: 'svc_hair_001', name: '唇部脱毛', category: '脱毛', unit_price: 298, duration_minutes: 30, description: '激光脱毛，唇部' },
    { id: 'svc_hair_002', name: '腋下脱毛', category: '脱毛', unit_price: 398, duration_minutes: 30, description: '激光脱毛，腋下' },
    { id: 'svc_hair_003', name: '全身脱毛', category: '脱毛', unit_price: 1980, duration_minutes: 120, description: '激光脱毛，全身' },
    { id: 'svc_laser_001', name: '光子嫩肤', category: '光电项目', unit_price: 880, duration_minutes: 45, description: '改善肤色不均' },
    { id: 'svc_laser_002', name: '点阵激光', category: '光电项目', unit_price: 1880, duration_minutes: 60, description: '改善痘坑痘印' },
    { id: 'svc_laser_003', name: '皮秒祛斑', category: '光电项目', unit_price: 3280, duration_minutes: 50, description: '去除各类色斑' },
  ];
  
  store.doctors = [
    { id: 'doc_001', name: '张医生', specialization: '皮肤科', status: 'active' },
    { id: 'doc_002', name: '李医生', specialization: '光电科', status: 'active' },
    { id: 'doc_003', name: '王医生', specialization: '综合美容', status: 'active' },
  ];
  
  store.customers = [
    { id: 'cust_001', name: '王美丽', phone: '13800138001', created_at: now(), updated_at: now() },
    { id: 'cust_002', name: '李小花', phone: '13800138002', created_at: now(), updated_at: now() },
    { id: 'cust_003', name: '张婷婷', phone: '13800138003', created_at: now(), updated_at: now() },
  ];
};

const prepare = (sql) => {
  return {
    get: (...params) => {
      if (sql.includes('SELECT COUNT(*) as count FROM services')) {
        return { count: store.services.length };
      }
      
      if (sql.includes('SELECT * FROM customer_packages WHERE customer_id = ? AND service_id = ?')) {
        const [customerId, serviceId] = params;
        const result = store.customerPackages
          .filter(p => p.customer_id === customerId && p.service_id === serviceId && p.status === 'active')
          .sort((a, b) => new Date(b.purchased_at) - new Date(a.purchased_at))[0];
        return result;
      }
      
      if (sql.includes('SELECT * FROM customer_packages WHERE id = ?')) {
        return store.customerPackages.find(p => p.id === params[0]);
      }
      
      if (sql.includes('SELECT * FROM appointments WHERE id = ?')) {
        return store.appointments.find(a => a.id === params[0]);
      }
      
      if (sql.includes('t.transaction_type = \'consume\'') && sql.includes('LEFT JOIN appointments a')) {
        const [customerId, serviceId, appointmentId, scheduledDate] = params;
        const scheduledDateStr = scheduledDate ? new Date(scheduledDate).toISOString().split('T')[0] : null;
        
        return store.transactions.find(t => {
          const sameDay = scheduledDateStr ? new Date(t.created_at).toISOString().split('T')[0] === scheduledDateStr : false;
          return t.transaction_type === 'consume' &&
            t.status === 'completed' &&
            t.customer_id === customerId &&
            t.service_id === serviceId &&
            ((t.appointment_id === appointmentId && t.appointment_id) || sameDay);
        });
      }
      
      return undefined;
    },
    
    all: (...params) => {
      if (sql.includes('SELECT * FROM services') && !sql.includes('WHERE')) {
        return store.services;
      }
      
      if (sql.includes('SELECT * FROM services WHERE category = ?')) {
        return store.services.filter(s => s.category === params[0]);
      }
      
      if (sql.includes('SELECT * FROM doctors WHERE status =')) {
        return store.doctors.filter(d => d.status === 'active');
      }
      
      if (sql.includes('SELECT * FROM customers')) {
        return store.customers;
      }
      
      if (sql.includes('cp.id as package_id')) {
        const customerId = params[0];
        return store.customerPackages
          .filter(p => p.customer_id === customerId && p.status === 'active')
          .map(pkg => {
            const svc = store.services.find(s => s.id === pkg.service_id);
            return {
              package_id: pkg.id,
              package_name: pkg.package_name,
              service_id: pkg.service_id,
              service_name: svc ? svc.name : '',
              category: svc ? svc.category : '',
              unit_price: svc ? svc.unit_price : 0,
              purchased_count: pkg.purchased_count,
              gifted_count: pkg.gifted_count,
              used_count: pkg.used_count,
              gifted_used_count: pkg.gifted_used_count,
              refunded_count: pkg.refunded_count,
              total_amount: pkg.total_amount
            };
          });
      }
      
      if (sql.includes('WHERE t.doctor_id = ?')) {
        const [doctorId, startDate, endDate] = params;
        return store.transactions
          .filter(t => 
            t.doctor_id === doctorId && 
            t.status === 'completed' &&
            t.created_at >= startDate &&
            t.created_at <= endDate
          )
          .map(t => {
            const c = store.customers.find(x => x.id === t.customer_id);
            const s = store.services.find(x => x.id === t.service_id);
            return {
              ...t,
              customer_name: c ? c.name : '',
              service_name: s ? s.name : '',
              category: s ? s.category : ''
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      if (sql.includes('WHERE t.transaction_type = \'refund\'')) {
        const [startDate, endDate, customerId] = params;
        return store.transactions
          .filter(t => {
            let match = t.transaction_type === 'refund' && 
              t.status === 'completed' &&
              t.created_at >= startDate &&
              t.created_at <= endDate;
            if (customerId) match = match && t.customer_id === customerId;
            return match;
          })
          .map(t => {
            const s = store.services.find(x => x.id === t.service_id);
            return {
              ...t,
              service_name: s ? s.name : '',
              category: s ? s.category : ''
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      if (sql.includes('LEFT JOIN doctors d ON t.doctor_id = d.id')) {
        const [startDate, endDate, customerId, transactionType] = params;
        return store.transactions
          .filter(t => {
            let match = t.created_at >= startDate && t.created_at <= endDate;
            if (customerId) match = match && t.customer_id === customerId;
            if (transactionType && transactionType !== startDate) match = match && t.transaction_type === transactionType;
            return match;
          })
          .map(t => {
            const c = store.customers.find(x => x.id === t.customer_id);
            const s = store.services.find(x => x.id === t.service_id);
            const d = store.doctors.find(x => x.id === t.doctor_id);
            return {
              ...t,
              customer_name: c ? c.name : '',
              customer_phone: c ? c.phone : '',
              service_name: s ? s.name : '',
              service_category: s ? s.category : '',
              doctor_name: d ? d.name : ''
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      if (sql.includes('t.created_at >= ?') && sql.includes('OR t.transaction_type = \'refund\'')) {
        const [startDate, endDate] = params;
        return store.transactions
          .filter(t => {
            return t.created_at >= startDate && t.created_at <= endDate &&
              ((t.transaction_type === 'consume' && t.gifted_count > 0 && t.count === 0) || t.transaction_type === 'refund');
          })
          .map(t => {
            const c = store.customers.find(x => x.id === t.customer_id);
            const s = store.services.find(x => x.id === t.service_id);
            return {
              ...t,
              customer_name: c ? c.name : '',
              service_name: s ? s.name : '',
              category: s ? s.category : '',
              anomaly_type: t.transaction_type === 'refund' 
                ? '退款交易' 
                : (t.gifted_count > 0 && t.count === 0 ? '全部使用赠送次数' : '常规交易')
            };
          })
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      
      return [];
    },
    
    run: (...params) => {
      if (sql.includes('INSERT INTO services')) {
        store.services.push({
          id: params[0],
          name: params[1],
          category: params[2],
          unit_price: params[3],
          duration_minutes: params[4],
          description: params[5]
        });
        return;
      }
      
      if (sql.includes('INSERT INTO doctors')) {
        store.doctors.push({
          id: params[0],
          name: params[1],
          specialization: params[2],
          status: params[3]
        });
        return;
      }
      
      if (sql.includes('INSERT INTO customers')) {
        store.customers.push({
          id: params[0],
          name: params[1],
          phone: params[2],
          created_at: now(),
          updated_at: now()
        });
        return;
      }
      
      if (sql.includes('INSERT INTO customer_packages')) {
        store.customerPackages.push({
          id: params[0],
          customer_id: params[1],
          service_id: params[2],
          package_name: params[3],
          purchased_count: params[4],
          gifted_count: 0,
          used_count: 0,
          gifted_used_count: 0,
          refunded_count: 0,
          total_amount: params[5] || 0,
          status: 'active',
          purchased_at: now()
        });
        return;
      }
      
      if (sql.includes('INSERT INTO appointments')) {
        store.appointments.push({
          id: params[0],
          customer_id: params[1],
          customer_package_id: params[2],
          doctor_id: params[3],
          service_id: params[4],
          scheduled_at: params[5],
          status: 'scheduled',
          confirmed_by_doctor: 0,
          consumed_count: 0,
          created_at: now()
        });
        return;
      }
      
      if (sql.includes('INSERT INTO transactions')) {
        store.transactions.push({
          id: params[0],
          customer_id: params[1],
          customer_package_id: params[2],
          appointment_id: params[3],
          doctor_id: params[4],
          service_id: params[5],
          transaction_type: params[6],
          count: params[7] || 0,
          gifted_count: params[8] || 0,
          amount: params[9] || 0,
          status: params[10] || 'completed',
          reason: params[11],
          related_transaction_id: params[12],
          created_at: now()
        });
        return;
      }
      
      if (sql.includes('INSERT INTO gifted_transactions')) {
        store.giftedTransactions.push({
          id: params[0],
          customer_id: params[1],
          customer_package_id: params[2],
          gifted_count: params[3],
          reason: params[4],
          created_at: now()
        });
        return;
      }
      
      if (sql.startsWith('UPDATE customer_packages')) {
        const id = params[params.length - 1];
        const pkg = store.customerPackages.find(p => p.id === id);
        if (pkg) {
          if (sql.includes('purchased_count') && sql.includes('total_amount')) {
            pkg.purchased_count = params[0];
            pkg.total_amount = params[1];
          } else if (sql.includes('gifted_count')) {
            pkg.gifted_count = params[0];
          } else if (sql.includes('used_count') && sql.includes('gifted_used_count')) {
            pkg.used_count = params[0];
            pkg.gifted_used_count = params[1];
          } else if (sql.includes('refunded_count')) {
            pkg.refunded_count = params[0];
          }
        }
        return;
      }
      
      if (sql.startsWith('UPDATE appointments')) {
        const id = params[params.length - 1];
        const appt = store.appointments.find(a => a.id === id);
        if (appt) {
          if (sql.includes('confirmed_by_doctor')) {
            appt.confirmed_by_doctor = 1;
            appt.status = 'confirmed';
          }
          if (sql.includes('consumed_count')) {
            appt.consumed_count = (appt.consumed_count || 0) + 1;
            appt.status = 'completed';
          }
        }
        return;
      }
    }
  };
};

const exec = (sql) => {};

module.exports = {
  initDb,
  prepare,
  exec,
  save: () => {}
};
