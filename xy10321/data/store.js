const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sampleData = require('./sampleData');

const dataDir = path.join(__dirname);

class Store {
  constructor() {
    this.data = JSON.parse(JSON.stringify(sampleData));
  }

  generateId(prefix) {
    return `${prefix}-${uuidv4().substr(0, 8)}`;
  }

  getPetTypes() {
    return this.data.petTypes;
  }

  getServices() {
    return this.data.services;
  }

  getAddOns() {
    return this.data.addOns;
  }

  getBeauticians() {
    return this.data.beauticians;
  }

  getSupplies() {
    return this.data.supplies;
  }

  getPets() {
    return this.data.pets;
  }

  getPetById(id) {
    return this.data.pets.find(p => p.id === id);
  }

  createPet(pet) {
    const newPet = {
      ...pet,
      id: this.generateId('pet')
    };
    this.data.pets.push(newPet);
    return newPet;
  }

  getAppointments(filters = {}) {
    let appointments = [...this.data.appointments];

    if (filters.date) {
      appointments = appointments.filter(a => a.date === filters.date);
    }
    if (filters.status) {
      appointments = appointments.filter(a => a.status === filters.status);
    }
    if (filters.beauticianId) {
      appointments = appointments.filter(a => a.beauticianId === parseInt(filters.beauticianId));
    }

    return appointments;
  }

  getAppointmentById(id) {
    return this.data.appointments.find(a => a.id === id);
  }

  createAppointment(appointment) {
    const newAppointment = {
      ...appointment,
      id: this.generateId('apt'),
      status: 'pending',
      addOns: [],
      supplyUsage: [],
      createdAt: this.formatDateTime(new Date()),
      updatedAt: this.formatDateTime(new Date())
    };

    this.data.appointments.push(newAppointment);
    this.addHistory(newAppointment.id, 'create', 'status', null, 'pending', '系统');

    return newAppointment;
  }

  updateAppointment(id, updates, operator = '系统') {
    const index = this.data.appointments.findIndex(a => a.id === id);
    if (index === -1) return null;

    const oldAppointment = { ...this.data.appointments[index] };
    const updatedAppointment = {
      ...oldAppointment,
      ...updates,
      updatedAt: this.formatDateTime(new Date())
    };

    this.data.appointments[index] = updatedAppointment;

    for (const key of Object.keys(updates)) {
      if (key !== 'updatedAt') {
        this.addHistory(
          id,
          'update',
          key,
          oldAppointment[key],
          updates[key],
          operator
        );
      }
    }

    return updatedAppointment;
  }

  approveAddOn(appointmentId, operator = '前台') {
    const appointment = this.getAppointmentById(appointmentId);
    if (!appointment || !appointment.pendingAddOn) return null;

    const addOnItem = this.data.addOns.find(a => a.id === appointment.pendingAddOn.addOnId);

    const updatedAppointment = this.updateAppointment(
      appointmentId,
      {
        addOns: [...appointment.addOns, appointment.pendingAddOn],
        totalPrice: appointment.totalPrice + appointment.pendingAddOn.price,
        endTime: appointment.pendingAddOn.newEndTime,
        pendingAddOn: null
      },
      operator
    );

    this.addHistory(
      appointmentId,
      'approve_addon',
      'addOns',
      null,
      addOnItem ? addOnItem.name : '加项',
      operator
    );

    return updatedAppointment;
  }

  rejectAddOn(appointmentId, reason, operator = '前台') {
    const appointment = this.getAppointmentById(appointmentId);
    if (!appointment || !appointment.pendingAddOn) return null;

    const addOnItem = this.data.addOns.find(a => a.id === appointment.pendingAddOn.addOnId);

    const updatedAppointment = this.updateAppointment(
      appointmentId,
      {
        pendingAddOn: null
      },
      operator
    );

    this.addHistory(
      appointmentId,
      'reject_addon',
      'addOns',
      addOnItem ? addOnItem.name : '加项',
      `驳回原因: ${reason}`,
      operator
    );

    return updatedAppointment;
  }

  requestAddOn(appointmentId, addOnRequest, operator = '美容师') {
    const appointment = this.getAppointmentById(appointmentId);
    if (!appointment) return null;

    const addOnItem = this.data.addOns.find(a => a.id === addOnRequest.addOnId);
    if (!addOnItem) return null;

    const [startH, startM] = appointment.endTime.split(':').map(Number);
    const newMinutes = startH * 60 + startM + addOnItem.duration;
    const newEndTime = `${String(Math.floor(newMinutes / 60)).padStart(2, '0')}:${String(newMinutes % 60).padStart(2, '0')}`;

    const pendingAddOn = {
      addOnId: addOnItem.id,
      price: addOnItem.price,
      duration: addOnItem.duration,
      newEndTime,
      reason: addOnRequest.reason || `添加${addOnItem.name}服务`
    };

    const updatedAppointment = this.updateAppointment(
      appointmentId,
      {
        pendingAddOn
      },
      operator
    );

    this.addHistory(
      appointmentId,
      'request_addon',
      'addOns',
      null,
      `申请${addOnItem.name}`,
      operator
    );

    return updatedAppointment;
  }

  updateAppointmentStatus(id, status, operator = '系统') {
    const appointment = this.getAppointmentById(id);
    if (!appointment) return null;

    const oldStatus = appointment.status;
    const updatedAppointment = this.updateAppointment(
      id,
      { status },
      operator
    );

    this.addHistory(
      id,
      status === 'closed' ? 'complete' : 'status_change',
      'status',
      oldStatus,
      status,
      operator
    );

    return updatedAppointment;
  }

  checkBeauticianConflict(beauticianId, date, startTime, endTime, excludeAppointmentId = null) {
    const appointments = this.getAppointments({ date, beauticianId });

    for (const apt of appointments) {
      if (excludeAppointmentId && apt.id === excludeAppointmentId) continue;
      if (apt.status === 'rejected' || apt.status === 'closed') continue;

      const aptStart = this.timeToMinutes(apt.startTime);
      const aptEnd = this.timeToMinutes(apt.endTime);
      const reqStart = this.timeToMinutes(startTime);
      const reqEnd = this.timeToMinutes(endTime);

      if (reqStart < aptEnd && reqEnd > aptStart) {
        return {
          conflict: true,
          conflictingAppointment: apt
        };
      }
    }

    return { conflict: false };
  }

  checkSupplies(supplyList) {
    const warnings = [];
    const insufficients = [];

    for (const item of supplyList) {
      const supply = this.data.supplies.find(s => s.id === item.supplyId);
      if (!supply) continue;

      if (supply.currentStock < item.quantity) {
        insufficients.push({
          supplyId: item.supplyId,
          supplyName: supply.name,
          required: item.quantity,
          available: supply.currentStock,
          message: `${supply.name}库存不足，需要${item.quantity}${supply.unit}，当前仅有${supply.currentStock}${supply.unit}`
        });
      } else if (supply.currentStock < supply.minStock) {
        warnings.push({
          supplyId: item.supplyId,
          supplyName: supply.name,
          required: item.quantity,
          available: supply.currentStock,
          message: `${supply.name}库存即将不足，请及时补货`
        });
      }
    }

    return { warnings, insufficients };
  }

  consumeSupplies(appointmentId, supplyUsage, operator = '美容师') {
    const appointment = this.getAppointmentById(appointmentId);
    if (!appointment) return null;

    const checkResult = this.checkSupplies(supplyUsage);
    if (checkResult.insufficients.length > 0) {
      return { success: false, errors: checkResult.insufficients };
    }

    for (const item of supplyUsage) {
      const supply = this.data.supplies.find(s => s.id === item.supplyId);
      if (supply) {
        supply.currentStock -= item.quantity;
        this.addHistory(
          appointmentId,
          'consume_supply',
          'supplies',
          null,
          `${supply.name}: -${item.quantity}${supply.unit}`,
          operator
        );
      }
    }

    const updatedAppointment = this.updateAppointment(
      appointmentId,
      {
        supplyUsage: [...appointment.supplyUsage, ...supplyUsage]
      },
      operator
    );

    return { success: true, appointment: updatedAppointment };
  }

  getBeauticianSchedule(beauticianId, date) {
    return this.getAppointments({ beauticianId, date })
      .filter(a => a.status !== 'rejected')
      .map(a => ({
        id: a.id,
        startTime: a.startTime,
        endTime: a.endTime,
        status: a.status,
        petId: a.petId
      }));
  }

  getHistories(appointmentId = null) {
    if (appointmentId) {
      return this.data.histories.filter(h => h.appointmentId === appointmentId);
    }
    return this.data.histories;
  }

  addHistory(appointmentId, action, field, oldValue, newValue, operator) {
    const history = {
      id: this.generateId('hist'),
      appointmentId,
      action,
      field,
      oldValue: oldValue === null ? null : JSON.stringify(oldValue),
      newValue: newValue === null ? null : JSON.stringify(newValue),
      operator,
      timestamp: this.formatDateTime(new Date())
    };
    this.data.histories.push(history);
    return history;
  }

  getDailyReport(date) {
    const appointments = this.getAppointments({ date });
    const closedAppointments = appointments.filter(a => a.status === 'closed');

    const projectRevenue = closedAppointments.reduce((sum, a) => sum + a.totalPrice, 0);

    const supplyConsumption = {};
    for (const apt of closedAppointments) {
      for (const usage of apt.supplyUsage) {
        if (!supplyConsumption[usage.supplyId]) {
          const supply = this.data.supplies.find(s => s.id === usage.supplyId);
          supplyConsumption[usage.supplyId] = {
            supplyId: usage.supplyId,
            name: supply ? supply.name : '未知',
            unit: supply ? supply.unit : '',
            quantity: 0,
            totalCost: 0,
            pricePerUnit: supply ? supply.pricePerUnit : 0
          };
        }
        supplyConsumption[usage.supplyId].quantity += usage.quantity;
        supplyConsumption[usage.supplyId].totalCost += usage.quantity * supplyConsumption[usage.supplyId].pricePerUnit;
      }
    }

    const pendingExceptions = appointments.filter(a => 
      a.status === 'pending' || 
      a.pendingAddOn || 
      a.supplyWarning
    );

    const supplyCost = Object.values(supplyConsumption).reduce((sum, s) => sum + s.totalCost, 0);
    const netIncome = projectRevenue - supplyCost;

    return {
      date,
      summary: {
        totalAppointments: appointments.length,
        closedAppointments: closedAppointments.length,
        pendingAppointments: appointments.filter(a => a.status === 'pending').length,
        projectRevenue,
        supplyCost,
        netIncome
      },
      appointments: closedAppointments,
      supplyConsumption: Object.values(supplyConsumption),
      pendingExceptions
    };
  }

  getPendingAddOns() {
    return this.data.appointments
      .filter(a => a.pendingAddOn)
      .map(a => ({
        appointmentId: a.id,
        petId: a.petId,
        beauticianId: a.beauticianId,
        pendingAddOn: a.pendingAddOn
      }));
  }

  getSupplyWarnings() {
    return this.data.supplies
      .filter(s => s.currentStock < s.minStock)
      .map(s => ({
        ...s,
        warning: s.currentStock <= 0 ? '库存耗尽' : '库存不足'
      }));
  }

  calculatePrice(serviceId, petTypeId, addOns = []) {
    const service = this.data.services.find(s => s.id === serviceId);
    const petType = this.data.petTypes.find(t => t.id === petTypeId);

    if (!service || !petType) return null;

    let totalPrice = service.basePrice * petType.priceMultiplier;
    let totalDuration = Math.max(service.duration, petType.baseTime);

    for (const addOnId of addOns) {
      const addOn = this.data.addOns.find(a => a.id === addOnId);
      if (addOn) {
        totalPrice += addOn.price;
        totalDuration += addOn.duration;
      }
    }

    return {
      basePrice: totalPrice,
      totalPrice,
      totalDuration
    };
  }

  timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  formatDateTime(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
  }
}

module.exports = new Store();
