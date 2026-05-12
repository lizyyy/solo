const Plant = require('../models/Plant');
const MaintenanceTask = require('../models/MaintenanceTask');
const RepottingRecord = require('../models/RepottingRecord');
const WitheringTreatment = require('../models/WitheringTreatment');
const Compensation = require('../models/Compensation');
const PlantMovement = require('../models/PlantMovement');
const RenewalContract = require('../models/RenewalContract');
const RenewalBill = require('../models/RenewalBill');
const StateMachineService = require('./StateMachineService');
const DeduplicationService = require('../utils/deduplication');
const HistoryService = require('../utils/history');
const { PLANT_STATUSES, MAINTENANCE_STATUSES, COMPENSATION_STATUSES, RENEWAL_STATUSES, BILL_STATUSES } = require('../utils/constants');

class PlantRentalService {
  static async createMaintenanceTask(data, requestId, operatedBy) {
    const result = await DeduplicationService.ensureUnique(requestId, 'maintenance', async () => {
      const task = await MaintenanceTask.create(data, requestId);
      await HistoryService.record('create', task.id, 'maintenance', 'create', operatedBy, null, task, requestId);
      return task;
    });
    return result;
  }

  static async startMaintenance(taskId, operatedBy) {
    const task = await MaintenanceTask.getById(taskId);
    if (!task) throw new Error('养护任务不存在');
    
    StateMachineService.validateMaintenanceTransition(task.status, MAINTENANCE_STATUSES.IN_PROGRESS);
    
    const oldData = { ...task };
    await MaintenanceTask.updateStatus(taskId, MAINTENANCE_STATUSES.IN_PROGRESS);
    const newTask = await MaintenanceTask.getById(taskId);
    
    await HistoryService.record('update', taskId, 'maintenance', 'start', operatedBy, oldData, newTask);
    return newTask;
  }

  static async completeMaintenance(taskId, notes, operatedBy) {
    const task = await MaintenanceTask.getById(taskId);
    if (!task) throw new Error('养护任务不存在');
    
    StateMachineService.validateMaintenanceTransition(task.status, MAINTENANCE_STATUSES.COMPLETED);
    
    const oldData = { ...task };
    await MaintenanceTask.updateStatus(taskId, MAINTENANCE_STATUSES.COMPLETED, notes);
    const newTask = await MaintenanceTask.getById(taskId);
    
    const plant = await Plant.getById(task.plant_id);
    if (plant && plant.status !== PLANT_STATUSES.HEALTHY) {
      const compensations = await Compensation.getByPlant(plant.id);
      const hasPaidCompensation = compensations.some(c => c.status === COMPENSATION_STATUSES.PAID);
      
      if (!hasPaidCompensation) {
        await Plant.updateStatus(plant.id, PLANT_STATUSES.HEALTHY);
      }
    }
    
    await HistoryService.record('update', taskId, 'maintenance', 'complete', operatedBy, oldData, newTask);
    return newTask;
  }

  static async markNeedsRepotting(taskId, operatedBy) {
    const task = await MaintenanceTask.getById(taskId);
    if (!task) throw new Error('养护任务不存在');
    
    StateMachineService.validateMaintenanceTransition(task.status, MAINTENANCE_STATUSES.NEEDS_REPOTTING);
    
    const oldData = { ...task };
    await MaintenanceTask.updateStatus(taskId, MAINTENANCE_STATUSES.NEEDS_REPOTTING);
    const newTask = await MaintenanceTask.getById(taskId);
    
    await Plant.updateStatus(task.plant_id, PLANT_STATUSES.NEEDS_CARE);
    
    await HistoryService.record('update', taskId, 'maintenance', 'needs_repotting', operatedBy, oldData, newTask);
    return newTask;
  }

  static async markNeedsCompensation(taskId, operatedBy) {
    const task = await MaintenanceTask.getById(taskId);
    if (!task) throw new Error('养护任务不存在');
    
    StateMachineService.validateMaintenanceTransition(task.status, MAINTENANCE_STATUSES.NEEDS_COMPENSATION);
    
    const oldData = { ...task };
    await MaintenanceTask.updateStatus(taskId, MAINTENANCE_STATUSES.NEEDS_COMPENSATION);
    const newTask = await MaintenanceTask.getById(taskId);
    
    await Plant.updateStatus(task.plant_id, PLANT_STATUSES.WILTED);
    
    await HistoryService.record('update', taskId, 'maintenance', 'needs_compensation', operatedBy, oldData, newTask);
    return newTask;
  }

  static async cancelMaintenance(taskId, reason, operatedBy) {
    const task = await MaintenanceTask.getById(taskId);
    if (!task) throw new Error('养护任务不存在');
    
    StateMachineService.validateMaintenanceTransition(task.status, MAINTENANCE_STATUSES.CANCELLED);
    
    const oldData = { ...task };
    await MaintenanceTask.cancel(taskId, reason, operatedBy);
    const newTask = await MaintenanceTask.getById(taskId);
    
    await HistoryService.record('update', taskId, 'maintenance', 'cancel', operatedBy, oldData, newTask);
    return newTask;
  }

  static async createRepottingRecord(data, requestId, operatedBy) {
    const result = await DeduplicationService.ensureUnique(requestId, 'repotting', async () => {
      const record = await RepottingRecord.create(data, requestId);
      
      const plant = await Plant.getById(data.plant_id);
      if (plant) {
        await Plant.updatePotNumber(data.plant_id, data.new_pot_number);
      }
      
      if (data.maintenance_task_id) {
        const task = await MaintenanceTask.getById(data.maintenance_task_id);
        if (task && task.status === MAINTENANCE_STATUSES.NEEDS_REPOTTING) {
          await MaintenanceTask.updateStatus(data.maintenance_task_id, MAINTENANCE_STATUSES.COMPLETED, '换盆完成');
        }
      }
      
      await HistoryService.record('create', record.id, 'repotting', 'create', operatedBy, null, record, requestId);
      return record;
    });
    return result;
  }

  static async createWitheringTreatment(data, requestId, operatedBy) {
    const result = await DeduplicationService.ensureUnique(requestId, 'withering', async () => {
      const treatment = await WitheringTreatment.create(data, requestId);
      
      if (data.result === 'recovered') {
        await Plant.updateStatus(data.plant_id, PLANT_STATUSES.HEALTHY);
      } else if (data.result === 'dead') {
        await Plant.updateStatus(data.plant_id, PLANT_STATUSES.DEAD);
      }
      
      await HistoryService.record('create', treatment.id, 'withering', 'create', operatedBy, null, treatment, requestId);
      return treatment;
    });
    return result;
  }

  static async createCompensation(data, requestId, operatedBy) {
    const result = await DeduplicationService.ensureUnique(requestId, 'compensation', async () => {
      const compensation = await Compensation.create(data, requestId);
      await HistoryService.record('create', compensation.id, 'compensation', 'create', operatedBy, null, compensation, requestId);
      return compensation;
    });
    return result;
  }

  static async approveCompensation(compensationId, approvedBy, notes = null) {
    const compensation = await Compensation.getById(compensationId);
    if (!compensation) throw new Error('赔偿记录不存在');
    
    StateMachineService.validateCompensationTransition(compensation.status, COMPENSATION_STATUSES.APPROVED);
    
    const oldData = { ...compensation };
    await Compensation.approve(compensationId, approvedBy, notes);
    const newCompensation = await Compensation.getById(compensationId);
    
    await HistoryService.record('update', compensationId, 'compensation', 'approve', approvedBy, oldData, newCompensation);
    return newCompensation;
  }

  static async markCompensationPaid(compensationId, operatedBy) {
    const compensation = await Compensation.getById(compensationId);
    if (!compensation) throw new Error('赔偿记录不存在');
    
    StateMachineService.validateCompensationTransition(compensation.status, COMPENSATION_STATUSES.PAID);
    
    const oldData = { ...compensation };
    await Compensation.markPaid(compensationId);
    const newCompensation = await Compensation.getById(compensationId);
    
    await HistoryService.record('update', compensationId, 'compensation', 'mark_paid', operatedBy, oldData, newCompensation);
    return newCompensation;
  }

  static async waiveCompensation(compensationId, reason, operatedBy) {
    const compensation = await Compensation.getById(compensationId);
    if (!compensation) throw new Error('赔偿记录不存在');
    
    StateMachineService.validateCompensationTransition(compensation.status, COMPENSATION_STATUSES.WAIVED);
    
    const oldData = { ...compensation };
    await Compensation.waive(compensationId, reason, operatedBy);
    const newCompensation = await Compensation.getById(compensationId);
    
    await HistoryService.record('update', compensationId, 'compensation', 'waive', operatedBy, oldData, newCompensation);
    return newCompensation;
  }

  static async movePlant(data, requestId, operatedBy) {
    const result = await DeduplicationService.ensureUnique(requestId, 'movement', async () => {
      const movement = await PlantMovement.create(data, requestId);
      await Plant.updateLocation(data.plant_id, data.to_location_id);
      await HistoryService.record('create', movement.id, 'movement', 'create', operatedBy, null, movement, requestId);
      return movement;
    });
    return result;
  }

  static async checkUnfinishedMaintenance(locationId) {
    const maintenanceTasks = await MaintenanceTask.getAll();
    const unfinishedTasks = maintenanceTasks.filter(
      t => t.location_id === locationId && 
           t.status !== MAINTENANCE_STATUSES.COMPLETED && 
           t.status !== MAINTENANCE_STATUSES.CANCELLED
    );
    return unfinishedTasks;
  }

  static async createRenewalContract(data, requestId, operatedBy) {
    const result = await DeduplicationService.ensureUnique(requestId, 'renewal', async () => {
      const unfinishedTasks = await this.checkUnfinishedMaintenance(data.location_id);
      if (unfinishedTasks.length > 0) {
        const taskIds = unfinishedTasks.map(t => t.id).join(', ');
        throw new Error(`该点位存在 ${unfinishedTasks.length} 个未完成的养护任务 (${taskIds})，请先完成养护再办理续租`);
      }
      
      const contract = await RenewalContract.create(data, requestId);
      await HistoryService.record('create', contract.id, 'renewal', 'create', operatedBy, null, contract, requestId);
      return contract;
    });
    return result;
  }

  static async confirmRenewalContract(contractId, operatedBy) {
    const contract = await RenewalContract.getById(contractId);
    if (!contract) throw new Error('续租合同不存在');
    
    StateMachineService.validateRenewalTransition(contract.status, RENEWAL_STATUSES.CONFIRMED);
    
    const unfinishedTasks = await this.checkUnfinishedMaintenance(contract.location_id);
    if (unfinishedTasks.length > 0) {
      const taskIds = unfinishedTasks.map(t => t.id).join(', ');
      throw new Error(`该点位存在 ${unfinishedTasks.length} 个未完成的养护任务 (${taskIds})，请先完成养护再确认续租`);
    }
    
    const oldData = { ...contract };
    await RenewalContract.confirm(contractId);
    const newContract = await RenewalContract.getById(contractId);
    
    await HistoryService.record('update', contractId, 'renewal', 'confirm', operatedBy, oldData, newContract);
    return newContract;
  }

  static async cancelRenewalContract(contractId, reason, operatedBy) {
    const contract = await RenewalContract.getById(contractId);
    if (!contract) throw new Error('续租合同不存在');
    
    StateMachineService.validateRenewalTransition(contract.status, RENEWAL_STATUSES.CANCELLED);
    
    const oldData = { ...contract };
    await RenewalContract.cancel(contractId, reason, operatedBy);
    const newContract = await RenewalContract.getById(contractId);
    
    await HistoryService.record('update', contractId, 'renewal', 'cancel', operatedBy, oldData, newContract);
    return newContract;
  }

  static async calculatePlantRentalInfo(plant, contractStartDate) {
    let shouldRent = true;
    let reason = '';
    let adjustedRent = plant.monthly_rent || 0;
    
    if (plant.status === PLANT_STATUSES.DEAD) {
      shouldRent = false;
      reason = '植物已死亡，不计租金';
      adjustedRent = 0;
    }
    
    const compensations = await Compensation.getByPlant(plant.id);
    const hasPaidCompensation = compensations.some(c => c.status === COMPENSATION_STATUSES.PAID);
    
    if (hasPaidCompensation) {
      shouldRent = false;
      reason = '植物已完成赔偿，不再计租金';
      adjustedRent = 0;
    }
    
    return {
      plant_id: plant.id,
      name: plant.name,
      species: plant.species,
      pot_number: plant.pot_number,
      status: plant.status,
      monthly_rent: plant.monthly_rent,
      adjusted_rent: adjustedRent,
      should_rent: shouldRent,
      reason: reason
    };
  }

  static async generateRenewalBill(contractId, operatedBy) {
    const contract = await RenewalContract.getById(contractId);
    if (!contract) throw new Error('续租合同不存在');
    
    StateMachineService.validateRenewalTransition(contract.status, RENEWAL_STATUSES.BILLED);
    
    const plants = await Plant.getByLocation(contract.location_id);
    
    const rentalInfos = await Promise.all(
      plants.map(p => this.calculatePlantRentalInfo(p, contract.start_date))
    );
    
    const billablePlants = rentalInfos.filter(info => info.should_rent);
    const rentalAmount = billablePlants.reduce((sum, info) => sum + info.adjusted_rent, 0);
    
    const allCompensations = await Compensation.getAll();
    const locationCompensations = allCompensations.filter(
      c => c.location_id === contract.location_id
    );
    
    const pendingCompensations = locationCompensations.filter(
      c => c.status === COMPENSATION_STATUSES.PENDING
    );
    const billableCompensations = locationCompensations.filter(
      c => c.status === COMPENSATION_STATUSES.APPROVED || c.status === COMPENSATION_STATUSES.PAID
    );
    
    if (pendingCompensations.length > 0) {
      const pendingIds = pendingCompensations.map(c => c.id).join(', ');
      throw new Error(`该点位存在 ${pendingCompensations.length} 个待审批的赔偿记录 (${pendingIds})，请先处理赔偿再生成账单`);
    }
    
    const compensationAmount = billableCompensations.reduce((sum, c) => sum + (c.amount || 0), 0);
    
    const billDetails = {
      plants: rentalInfos,
      compensations: locationCompensations.map(c => ({
        id: c.id,
        amount: c.amount,
        reason: c.reason,
        status: c.status
      })),
      summary: {
        total_plants: plants.length,
        billable_plants: billablePlants.length,
        unbilled_plants: plants.length - billablePlants.length,
        billable_compensations_count: billableCompensations.length
      }
    };
    
    const billData = {
      renewal_contract_id: contractId,
      customer_id: contract.customer_id,
      bill_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      plant_details: JSON.stringify(billDetails),
      rental_amount: rentalAmount,
      compensation_amount: compensationAmount,
      total_amount: rentalAmount + compensationAmount,
      status: BILL_STATUSES.DRAFT
    };
    
    const requestId = `bill_${contractId}_${Date.now()}`;
    const bill = await RenewalBill.create(billData, requestId);
    
    await RenewalContract.markBilled(contractId);
    
    await HistoryService.record('create', bill.id, 'bill', 'generate', operatedBy, null, bill, requestId);
    return bill;
  }

  static async issueBill(billId, operatedBy) {
    const bill = await RenewalBill.getById(billId);
    if (!bill) throw new Error('账单不存在');
    
    StateMachineService.validateBillTransition(bill.status, BILL_STATUSES.ISSUED);
    
    const oldData = { ...bill };
    await RenewalBill.issue(billId);
    const newBill = await RenewalBill.getById(billId);
    
    await HistoryService.record('update', billId, 'bill', 'issue', operatedBy, oldData, newBill);
    return newBill;
  }

  static async markBillPaid(billId, operatedBy) {
    const bill = await RenewalBill.getById(billId);
    if (!bill) throw new Error('账单不存在');
    
    StateMachineService.validateBillTransition(bill.status, BILL_STATUSES.PAID);
    
    const oldData = { ...bill };
    await RenewalBill.markPaid(billId);
    const newBill = await RenewalBill.getById(billId);
    
    await HistoryService.record('update', billId, 'bill', 'mark_paid', operatedBy, oldData, newBill);
    return newBill;
  }

  static async getPlantHistory(plantId) {
    const maintenance = await MaintenanceTask.getByPlant(plantId);
    const repottings = await RepottingRecord.getByPlant(plantId);
    const witherings = await WitheringTreatment.getByPlant(plantId);
    const compensations = await Compensation.getByPlant(plantId);
    const movements = await PlantMovement.getByPlant(plantId);
    
    return {
      maintenance_tasks: maintenance,
      repotting_records: repottings,
      withering_treatments: witherings,
      compensations: compensations,
      movements: movements
    };
  }
}

module.exports = PlantRentalService;
