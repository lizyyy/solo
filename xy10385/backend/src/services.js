const DAOs = require('./daos');
const { isScheduleOverlap, buildOperationKey, dataHash } = require('./utils');
const { format } = require('date-fns');

class OrderService {
  createOrder(orderData) {
    if (orderData.escort_id && orderData.start_time) {
      const date = orderData.start_time.split(' ')[0];
      const startTime = orderData.start_time.split(' ')[1] || '08:00';
      const endTime = orderData.end_time ? orderData.end_time.split(' ')[1] : '12:00';
      
      const schedules = DAOs.ScheduleDAO.getByEscortAndDate(orderData.escort_id, date);
      if (isScheduleOverlap(date, startTime, endTime, schedules)) {
        throw new Error('陪诊员在该时间段已有排班冲突');
      }
    }

    const order = DAOs.OrderDAO.create(orderData);

    const timelineNodes = [
      { node_type: 'accept', node_name: '接单', sequence: 1 },
      { node_type: 'meet', node_name: '接站/见患者', sequence: 2 },
      { node_type: 'register', node_name: '挂号取号', sequence: 3 },
      { node_type: 'consult', node_name: '就诊咨询', sequence: 4 },
      { node_type: 'examination', node_name: '检查/治疗', sequence: 5 },
      { node_type: 'medicine', node_name: '取药缴费', sequence: 6 },
      { node_type: 'complete', node_name: '服务完成', sequence: 7 }
    ];

    timelineNodes.forEach(node => {
      DAOs.TimelineDAO.create({
        order_id: order.id,
        node_type: node.node_type,
        node_name: node.node_name,
        sequence: node.sequence,
        operator: null,
        notes: null
      });
    });

    if (orderData.escort_id && orderData.start_time) {
      const date = orderData.start_time.split(' ')[0];
      const startTime = orderData.start_time.split(' ')[1] || '08:00';
      const endTime = orderData.end_time ? orderData.end_time.split(' ')[1] : '12:00';
      
      DAOs.ScheduleDAO.create({
        escort_id: orderData.escort_id,
        date: date,
        start_time: startTime,
        end_time: endTime,
        order_id: order.id,
        notes: `订单：${order.order_no}`
      });
    }

    if (orderData.examination_ids && orderData.examination_ids.length > 0) {
      orderData.examination_ids.forEach(examId => {
        DAOs.OrderExaminationDAO.create({
          order_id: order.id,
          examination_id: examId,
          is_added: false
        });
      });
    }

    return order;
  }

  updateOrder(orderId, updateData) {
    if (DAOs.OrderDAO.isCompleted(orderId)) {
      throw new Error('已结束订单不能修改');
    }
    return DAOs.OrderDAO.update(orderId, updateData);
  }

  advanceTimeline(orderId, nodeType, operator = '系统', notes = '') {
    if (DAOs.OrderDAO.isCompleted(orderId)) {
      throw new Error('已结束订单不能推进流程');
    }

    const timeline = DAOs.TimelineDAO.getByOrderId(orderId);
    const currentNode = timeline.find(t => t.status === 'pending');
    
    if (!currentNode) {
      throw new Error('没有待完成的流程节点');
    }

    if (nodeType !== currentNode.node_type) {
      throw new Error(`请按顺序推进流程，当前应该完成：${currentNode.node_name}`);
    }

    DAOs.TimelineDAO.complete(currentNode.id, operator, notes);

    const updatedTimeline = DAOs.TimelineDAO.getByOrderId(orderId);
    const allCompleted = updatedTimeline.every(t => t.status === 'completed');
    
    if (allCompleted) {
      DAOs.OrderDAO.updateStatus(orderId, 'completed');
      return { status: 'order_completed', message: '订单已完成' };
    }

    return { status: 'node_completed', node_type: nodeType, message: `已完成：${currentNode.node_name}` };
  }

  addExamination(orderId, examinationId, operator = '系统') {
    if (DAOs.OrderDAO.isCompleted(orderId)) {
      throw new Error('已结束订单不能加项');
    }

    DAOs.OrderExaminationDAO.create({
      order_id: orderId,
      examination_id: examinationId,
      is_added: true
    });

    return { success: true, message: '加项申请已提交，等待审批' };
  }

  approveExamination(oeId, operator = '管理员') {
    DAOs.OrderExaminationDAO.approve(oeId, operator);
    return { success: true, message: '加项已批准' };
  }

  rejectExamination(oeId, operator = '管理员') {
    DAOs.OrderExaminationDAO.reject(oeId, operator);
    return { success: true, message: '加项已拒绝' };
  }

  billOrder(orderId, operator = '系统') {
    if (DAOs.OrderDAO.isCompleted(orderId)) {
      throw new Error('已结束订单不能重复计费');
    }

    const unapproved = DAOs.OrderExaminationDAO.getUnapprovedAdditions(orderId);
    if (unapproved.length > 0) {
      throw new Error('存在未审批的临时加项，无法计费');
    }

    const opKey = buildOperationKey(orderId, 'bill', dataHash({ orderId, operator }));
    const existing = DAOs.IdempotentDAO.getByKey(opKey);
    
    if (existing) {
      return { 
        success: true, 
        idempotent: true,
        message: '该计费操作已执行过',
        result: JSON.parse(existing.result)
      };
    }

    const exams = DAOs.OrderExaminationDAO.getByOrderId(orderId);
    const approvedExams = exams.filter(e => e.approval_status === 'approved');
    
    let totalExamFee = 0;
    approvedExams.forEach(exam => {
      if (!exam.billed) {
        const feeAmount = exam.unit_price * exam.quantity;
        DAOs.OrderFeeDAO.create({
          order_id: orderId,
          fee_type: 'examination',
          item_name: exam.exam_name,
          amount: feeAmount,
          related_id: exam.id,
          notes: operator
        });
        DAOs.OrderExaminationDAO.markBilled(exam.id);
        totalExamFee += feeAmount;
      }
    });

    const existingServiceFee = DAOs.OrderFeeDAO.getByOrderId(orderId)
      .filter(f => f.fee_type === 'service');
    
    let serviceFeeAmount = 0;
    if (existingServiceFee.length === 0) {
      serviceFeeAmount = 200;
      DAOs.OrderFeeDAO.create({
        order_id: orderId,
        fee_type: 'service',
        item_name: '陪诊服务费',
        amount: serviceFeeAmount,
        notes: operator
      });
    }

    const summary = DAOs.OrderFeeDAO.getSummary(orderId);
    DAOs.OrderDAO.updateAmounts(orderId, summary.total, summary.total, summary.refund);

    const result = {
      total_amount: summary.total,
      service_fee: summary.service_fee,
      examination_fee: summary.examination_fee
    };

    DAOs.IdempotentDAO.checkAndRecord(opKey, orderId, result);

    return { 
      success: true, 
      idempotent: false,
      message: '计费完成',
      result
    };
  }

  cancelOrder(orderId, operator = '系统', reason = '') {
    if (DAOs.OrderDAO.isCompleted(orderId)) {
      throw new Error('已结束订单不能重复取消');
    }

    const order = DAOs.OrderDAO.getById(orderId);
    if (!order) throw new Error('订单不存在');

    DAOs.OrderDAO.updateStatus(orderId, 'cancelled');
    DAOs.ScheduleDAO.deleteByOrder(orderId);

    return { success: true, message: '订单已取消' };
  }

  refundOrder(orderId, refundAmount, operator = '系统', reason = '') {
    if (!DAOs.OrderDAO.isCompleted(orderId)) {
      throw new Error('只有已完成订单才能退款');
    }

    const opKey = buildOperationKey(orderId, 'refund', dataHash({ orderId, refundAmount }));
    const existing = DAOs.IdempotentDAO.getByKey(opKey);
    
    if (existing) {
      return { 
        success: true, 
        idempotent: true,
        message: '该退款操作已执行过',
        result: JSON.parse(existing.result)
      };
    }

    const order = DAOs.OrderDAO.getById(orderId);
    if (!order) throw new Error('订单不存在');

    const actualRefund = Math.min(refundAmount, order.paid_amount - order.refund_amount);
    
    if (actualRefund > 0) {
      DAOs.OrderFeeDAO.create({
        order_id: orderId,
        fee_type: 'refund',
        item_name: '退款',
        amount: -actualRefund,
        notes: `${reason} - ${operator}`
      });

      const summary = DAOs.OrderFeeDAO.getSummary(orderId);
      DAOs.OrderDAO.updateAmounts(orderId, summary.total, summary.total, summary.refund);
      DAOs.OrderDAO.updateStatus(orderId, 'refunded');
    }

    const result = {
      refund_amount: actualRefund,
      net_payable: order.total_amount - actualRefund
    };

    DAOs.IdempotentDAO.checkAndRecord(opKey, orderId, result);

    return { 
      success: true, 
      idempotent: false,
      message: actualRefund > 0 ? `退款成功：${actualRefund}元` : '无金额可退',
      result
    };
  }

  getOrderDetail(orderId) {
    const order = DAOs.OrderDAO.getById(orderId);
    if (!order) return null;

    return {
      ...order,
      timeline: DAOs.TimelineDAO.getByOrderId(orderId),
      examinations: DAOs.OrderExaminationDAO.getByOrderId(orderId),
      fees: DAOs.OrderFeeDAO.getByOrderId(orderId),
      fee_summary: DAOs.OrderFeeDAO.getSummary(orderId)
    };
  }

  generateReport(orderId) {
    const detail = this.getOrderDetail(orderId);
    if (!detail) return null;

    const completedNodes = detail.timeline
      .filter(t => t.status === 'completed')
      .map(t => ({
        节点: t.node_name,
        完成时间: t.completed_at || '-',
        操作人: t.operator || '-',
        备注: t.notes || '-'
      }));

    const examItems = detail.examinations
      .filter(e => e.approval_status === 'approved')
      .map(e => ({
        项目: e.exam_name,
        科室: e.department,
        单价: e.unit_price,
        数量: e.quantity,
        小计: e.unit_price * e.quantity,
        类型: e.is_added ? '临时加项' : '预约项目'
      }));

    return {
      订单号: detail.order_no,
      患者信息: {
        姓名: detail.patient_name,
        电话: detail.patient_phone,
        年龄: detail.patient_age,
        性别: detail.patient_gender
      },
      陪诊员: detail.escort_name || '未分配',
      科室: detail.department || '-',
      医院: detail.hospital || '-',
      订单状态: this.getStatusText(detail.status),
      服务时间: detail.start_time ? `${detail.start_time} ~ ${detail.end_time || '-'}` : '-',
      完成事项: completedNodes,
      检查项目: examItems,
      费用明细: {
        陪诊服务费: detail.fee_summary.service_fee,
        '检查/治疗费': detail.fee_summary.examination_fee,
        退款: detail.fee_summary.refund,
        实付金额: detail.fee_summary.net_payable
      },
      生成时间: format(new Date(), 'yyyy-MM-dd HH:mm:ss')
    };
  }

  getStatusText(status) {
    const map = {
      pending: '待处理',
      accepted: '已接单',
      in_progress: '进行中',
      completed: '已完成',
      cancelled: '已取消',
      refunded: '已退款'
    };
    return map[status] || status;
  }
}

class ScheduleService {
  getEscortAvailability(escortId, date) {
    return DAOs.ScheduleDAO.getByEscortAndDate(escortId, date);
  }

  getEscortScheduleRange(escortId, startDate, endDate) {
    return DAOs.ScheduleDAO.getByDateRange(escortId, startDate, endDate);
  }

  checkConflict(escortId, date, startTime, endTime) {
    const schedules = DAOs.ScheduleDAO.getByEscortAndDate(escortId, date);
    const hasConflict = isScheduleOverlap(date, startTime, endTime, schedules);
    return {
      has_conflict: hasConflict,
      conflicts: hasConflict ? schedules : []
    };
  }
}

module.exports = {
  OrderService: new OrderService(),
  ScheduleService: new ScheduleService()
};
