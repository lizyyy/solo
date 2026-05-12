class MemoryStore {
  constructor() {
    this.orders = new Map();
    this.complaints = new Map();
    this.operations = [];
  }

  saveOrder(order) {
    this.orders.set(order.id, order);
    if (order.orderNo) {
      this.orders.set(order.orderNo, order);
    }
    return order;
  }

  getOrderById(id) {
    return this.orders.get(id);
  }

  getOrderByOrderNo(orderNo) {
    return this.orders.get(orderNo);
  }

  getAllOrders() {
    return Array.from(new Set(this.orders.values()));
  }

  saveComplaint(complaint) {
    this.complaints.set(complaint.id, complaint);
    if (complaint.complaintNo) {
      this.complaints.set(complaint.complaintNo, complaint);
    }
    return complaint;
  }

  getComplaintById(id) {
    return this.complaints.get(id);
  }

  getComplaintByNo(complaintNo) {
    return this.complaints.get(complaintNo);
  }

  getComplaintsByOrderId(orderId) {
    return this.getAllComplaints().filter(c => c.orderId === orderId);
  }

  getComplaintsByUserId(userId) {
    return this.getAllComplaints().filter(c => c.userId === userId);
  }

  getComplaintsByGroupLeaderId(groupLeaderId) {
    return this.getAllComplaints().filter(c => c.groupLeaderId === groupLeaderId);
  }

  getAllComplaints() {
    return Array.from(new Set(this.complaints.values()));
  }

  queryComplaints(filter = {}) {
    let results = this.getAllComplaints();
    
    if (filter.status) {
      results = results.filter(c => c.status === filter.status);
    }
    if (filter.orderId) {
      results = results.filter(c => c.orderId === filter.orderId);
    }
    if (filter.userId) {
      results = results.filter(c => c.userId === filter.userId);
    }
    if (filter.groupLeaderId) {
      results = results.filter(c => c.groupLeaderId === filter.groupLeaderId);
    }
    if (filter.startTime) {
      const start = new Date(filter.startTime);
      results = results.filter(c => new Date(c.filedTime) >= start);
    }
    if (filter.endTime) {
      const end = new Date(filter.endTime);
      results = results.filter(c => new Date(c.filedTime) <= end);
    }
    
    return results;
  }

  recordOperation(operation) {
    this.operations.push({
      ...operation,
      timestamp: new Date()
    });
  }

  getOperations() {
    return [...this.operations];
  }

  clearAll() {
    this.orders.clear();
    this.complaints.clear();
    this.operations = [];
  }
}

module.exports = new MemoryStore();
