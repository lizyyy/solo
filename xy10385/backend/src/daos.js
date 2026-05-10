const { db } = require('./database');
const { generateId, generateOrderNo, generateTransactionNo } = require('./utils');

function now() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

class OrderDAO {
  getAll(filters = {}) {
    let result = [...db._data.orders];
    
    if (filters.status) {
      result = result.filter(o => o.status === filters.status);
    }
    if (filters.escort_id) {
      result = result.filter(o => o.escort_id === filters.escort_id);
    }
    
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    return result.map(o => ({
      ...o,
      patient_name: db._data.patients.find(p => p.id === o.patient_id)?.name,
      escort_name: db._data.escorts.find(e => e.id === o.escort_id)?.name
    }));
  }

  getById(id) {
    const order = db._data.orders.find(o => o.id === id);
    if (!order) return null;
    
    const patient = db._data.patients.find(p => p.id === order.patient_id);
    const escort = db._data.escorts.find(e => e.id === order.escort_id);
    
    return {
      ...order,
      patient_name: patient?.name,
      patient_phone: patient?.phone,
      patient_age: patient?.age,
      patient_gender: patient?.gender,
      patient_id_card: patient?.id_card,
      escort_name: escort?.name,
      escort_phone: escort?.phone
    };
  }

  create(orderData) {
    const id = generateId();
    const orderNo = generateOrderNo();
    const createdAt = now();
    
    const order = {
      id,
      order_no: orderNo,
      patient_id: orderData.patient_id,
      escort_id: orderData.escort_id,
      service_type: orderData.service_type || 'normal',
      start_time: orderData.start_time,
      end_time: orderData.end_time,
      department: orderData.department,
      hospital: orderData.hospital,
      notes: orderData.notes,
      status: 'pending',
      total_amount: 0,
      paid_amount: 0,
      refund_amount: 0,
      created_at: createdAt,
      updated_at: createdAt
    };
    
    db._data.orders.push(order);
    db.save();
    
    return this.getById(id);
  }

  updateStatus(id, status) {
    const order = db._data.orders.find(o => o.id === id);
    if (order) {
      order.status = status;
      order.updated_at = now();
      db.save();
    }
    return { changes: order ? 1 : 0 };
  }

  updateAmounts(id, totalAmount, paidAmount, refundAmount) {
    const order = db._data.orders.find(o => o.id === id);
    if (order) {
      order.total_amount = totalAmount;
      order.paid_amount = paidAmount;
      order.refund_amount = refundAmount;
      order.updated_at = now();
      db.save();
    }
    return { changes: order ? 1 : 0 };
  }

  update(id, data) {
    const order = db._data.orders.find(o => o.id === id);
    if (!order) return null;
    
    if (data.escort_id !== undefined) order.escort_id = data.escort_id;
    if (data.notes !== undefined) order.notes = data.notes;
    if (data.start_time !== undefined) order.start_time = data.start_time;
    if (data.end_time !== undefined) order.end_time = data.end_time;
    order.updated_at = now();
    
    db.save();
    return { changes: 1 };
  }

  isCompleted(id) {
    const order = db._data.orders.find(o => o.id === id);
    return order && ['completed', 'cancelled', 'refunded'].includes(order.status);
  }
}

class PatientDAO {
  getAll() {
    return [...db._data.patients].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );
  }

  getById(id) {
    return db._data.patients.find(p => p.id === id);
  }

  create(data) {
    const id = generateId();
    const patient = {
      id,
      name: data.name,
      phone: data.phone,
      id_card: data.id_card,
      age: data.age,
      gender: data.gender,
      created_at: now()
    };
    db._data.patients.push(patient);
    db.save();
    return patient;
  }
}

class EscortDAO {
  getAll() {
    return [...db._data.escorts].sort((a, b) => a.name.localeCompare(b.name));
  }

  getById(id) {
    return db._data.escorts.find(e => e.id === id);
  }

  create(data) {
    const id = generateId();
    const escort = {
      id,
      name: data.name,
      phone: data.phone,
      status: 'active',
      skills: data.skills,
      created_at: now()
    };
    db._data.escorts.push(escort);
    db.save();
    return escort;
  }
}

class ExaminationDAO {
  getAll() {
    return [...db._data.examinations].sort((a, b) => {
      if (a.department !== b.department) return a.department.localeCompare(b.department);
      return a.name.localeCompare(b.name);
    });
  }

  getById(id) {
    return db._data.examinations.find(e => e.id === id);
  }

  create(data) {
    const id = generateId();
    const exam = {
      id,
      name: data.name,
      department: data.department,
      price: data.price,
      duration: data.duration || 60,
      description: data.description
    };
    db._data.examinations.push(exam);
    db.save();
    return exam;
  }
}

class TimelineDAO {
  getByOrderId(orderId) {
    return db._data.order_timeline
      .filter(t => t.order_id === orderId)
      .sort((a, b) => {
        if (a.sequence !== b.sequence) return a.sequence - b.sequence;
        return new Date(a.created_at) - new Date(b.created_at);
      });
  }

  create(data) {
    const id = generateId();
    const node = {
      id,
      order_id: data.order_id,
      node_type: data.node_type,
      node_name: data.node_name,
      sequence: data.sequence,
      status: 'pending',
      operator: data.operator || null,
      notes: data.notes || null,
      completed_at: null,
      created_at: now()
    };
    db._data.order_timeline.push(node);
    db.save();
    return id;
  }

  complete(id, operator, notes) {
    const node = db._data.order_timeline.find(t => t.id === id);
    if (node) {
      node.status = 'completed';
      node.completed_at = now();
      node.operator = operator;
      node.notes = notes;
      db.save();
    }
    return { changes: node ? 1 : 0 };
  }

  completeByType(orderId, nodeType, operator, notes) {
    const nodes = db._data.order_timeline.filter(
      t => t.order_id === orderId && t.node_type === nodeType
    );
    nodes.forEach(node => {
      node.status = 'completed';
      node.completed_at = now();
      node.operator = operator;
      node.notes = notes;
    });
    db.save();
    return { changes: nodes.length };
  }
}

class ScheduleDAO {
  getByEscortAndDate(escortId, date) {
    return db._data.schedules
      .filter(s => s.escort_id === escortId && s.date === date)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map(s => {
        const order = db._data.orders.find(o => o.id === s.order_id);
        return {
          ...s,
          order_no: order?.order_no,
          order_status: order?.status
        };
      });
  }

  getByDateRange(escortId, startDate, endDate) {
    return db._data.schedules
      .filter(s => s.escort_id === escortId && s.date >= startDate && s.date <= endDate)
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      })
      .map(s => {
        const order = db._data.orders.find(o => o.id === s.order_id);
        return {
          ...s,
          order_no: order?.order_no,
          order_status: order?.status
        };
      });
  }

  create(data) {
    const id = generateId();
    const schedule = {
      id,
      escort_id: data.escort_id,
      date: data.date,
      start_time: data.start_time,
      end_time: data.end_time,
      order_id: data.order_id,
      status: 'confirmed',
      notes: data.notes,
      created_at: now()
    };
    db._data.schedules.push(schedule);
    db.save();
    return id;
  }

  deleteByOrder(orderId) {
    const before = db._data.schedules.length;
    db._data.schedules = db._data.schedules.filter(s => s.order_id !== orderId);
    db.save();
    return { changes: before - db._data.schedules.length };
  }
}

class OrderExaminationDAO {
  getByOrderId(orderId) {
    return db._data.order_examinations
      .filter(oe => oe.order_id === orderId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(oe => {
        const exam = db._data.examinations.find(e => e.id === oe.examination_id);
        return {
          ...oe,
          exam_name: exam?.name,
          department: exam?.department,
          duration: exam?.duration
        };
      });
  }

  create(data) {
    const id = generateId();
    const exam = db._data.examinations.find(e => e.id === data.examination_id);
    
    const orderExam = {
      id,
      order_id: data.order_id,
      examination_id: data.examination_id,
      is_added: data.is_added ? 1 : 0,
      approval_status: data.is_added ? 'pending' : 'approved',
      approved_by: data.is_added ? null : 'system',
      approved_at: data.is_added ? null : now(),
      quantity: 1,
      unit_price: exam?.price || 0,
      billed: 0,
      billed_at: null,
      created_at: now()
    };
    
    db._data.order_examinations.push(orderExam);
    db.save();
    return id;
  }

  approve(id, approvedBy) {
    const oe = db._data.order_examinations.find(x => x.id === id);
    if (oe) {
      oe.approval_status = 'approved';
      oe.approved_by = approvedBy;
      oe.approved_at = now();
      db.save();
    }
    return { changes: oe ? 1 : 0 };
  }

  reject(id, approvedBy) {
    const oe = db._data.order_examinations.find(x => x.id === id);
    if (oe) {
      oe.approval_status = 'rejected';
      oe.approved_by = approvedBy;
      oe.approved_at = now();
      db.save();
    }
    return { changes: oe ? 1 : 0 };
  }

  markBilled(id) {
    const oe = db._data.order_examinations.find(x => x.id === id);
    if (oe) {
      oe.billed = 1;
      oe.billed_at = now();
      db.save();
    }
    return { changes: oe ? 1 : 0 };
  }

  getUnapprovedAdditions(orderId) {
    return db._data.order_examinations.filter(
      oe => oe.order_id === orderId && oe.is_added === 1 && oe.approval_status !== 'approved'
    );
  }
}

class OrderFeeDAO {
  getByOrderId(orderId) {
    return db._data.order_fees
      .filter(f => f.order_id === orderId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }

  create(data) {
    const id = generateId();
    const txnNo = data.transaction_no || generateTransactionNo();
    
    const fee = {
      id,
      order_id: data.order_id,
      fee_type: data.fee_type,
      item_name: data.item_name,
      amount: data.amount,
      related_id: data.related_id,
      notes: data.notes,
      transaction_no: txnNo,
      created_at: now()
    };
    
    db._data.order_fees.push(fee);
    db.save();
    return { id, transaction_no: txnNo };
  }

  getSummary(orderId) {
    const fees = this.getByOrderId(orderId);
    const serviceFees = fees.filter(f => f.fee_type === 'service').reduce((s, f) => s + f.amount, 0);
    const examFees = fees.filter(f => f.fee_type === 'examination').reduce((s, f) => s + f.amount, 0);
    const refunds = fees.filter(f => f.fee_type === 'refund').reduce((s, f) => s + Math.abs(f.amount), 0);
    
    return {
      total: serviceFees + examFees,
      service_fee: serviceFees,
      examination_fee: examFees,
      refund: refunds,
      net_payable: serviceFees + examFees - refunds
    };
  }
}

class IdempotentDAO {
  checkAndRecord(key, orderId, result) {
    const existing = db._data.idempotent_records.find(r => r.operation_key === key);
    if (existing) {
      return { exists: true, record: existing };
    }
    
    const id = generateId();
    const record = {
      id,
      operation_key: key,
      order_id: orderId,
      result: JSON.stringify(result),
      created_at: now()
    };
    
    db._data.idempotent_records.push(record);
    db.save();
    
    return { exists: false, record: null };
  }

  getByKey(key) {
    return db._data.idempotent_records.find(r => r.operation_key === key);
  }
}

module.exports = {
  OrderDAO: new OrderDAO(),
  PatientDAO: new PatientDAO(),
  EscortDAO: new EscortDAO(),
  ExaminationDAO: new ExaminationDAO(),
  TimelineDAO: new TimelineDAO(),
  ScheduleDAO: new ScheduleDAO(),
  OrderExaminationDAO: new OrderExaminationDAO(),
  OrderFeeDAO: new OrderFeeDAO(),
  IdempotentDAO: new IdempotentDAO()
};
