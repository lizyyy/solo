import storage from './StorageService.js';
import DosageRule from '../models/DosageRule.js';
import Prescription from '../models/Prescription.js';
import Inventory from '../models/Inventory.js';

class PharmacyService {
  async calculateDosage(medicineId, species, weight, weightUnit = 'kg') {
    const rules = await storage.find('dosageRules', r => r.medicineId === medicineId);
    
    if (rules.length === 0) {
      throw new Error(`未找到药品ID为 ${medicineId} 的剂量规则`);
    }

    const matchingRules = rules.filter(rule => {
      const dosageRule = new DosageRule(rule);
      return dosageRule.matches(species, weight, weightUnit);
    });

    if (matchingRules.length === 0) {
      throw new Error(`未找到适用于 ${species} ${weight}${weightUnit} 的剂量规则`);
    }

    const bestRule = new DosageRule(matchingRules[0]);
    return bestRule.calculateDosage(weight, weightUnit);
  }

  async checkInventory(medicineId, requiredQuantity, batchNumber = null) {
    let inventoryItems = await storage.find('inventory', item => 
      item.medicineId === medicineId && item.quantity > 0
    );

    if (batchNumber) {
      inventoryItems = inventoryItems.filter(item => item.batchNumber === batchNumber);
    }

    const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
    const expiringItems = inventoryItems.filter(item => {
      const inventory = new Inventory(item);
      return inventory.daysUntilExpiry() <= 30;
    });

    return {
      available: totalAvailable >= requiredQuantity,
      totalAvailable,
      required: requiredQuantity,
      deficit: Math.max(0, requiredQuantity - totalAvailable),
      expiringItems,
      batches: inventoryItems.map(item => ({
        id: item.id,
        batchNumber: item.batchNumber,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
        daysUntilExpiry: new Inventory(item).daysUntilExpiry(),
        location: item.location
      }))
    };
  }

  async allocateInventory(medicineId, quantity, preferOldest = true) {
    let inventoryItems = await storage.find('inventory', item => 
      item.medicineId === medicineId && item.quantity > 0
    );

    if (preferOldest) {
      inventoryItems.sort((a, b) => {
        const dateA = a.expiryDate ? new Date(a.expiryDate) : new Date('9999-12-31');
        const dateB = b.expiryDate ? new Date(b.expiryDate) : new Date('9999-12-31');
        return dateA - dateB;
      });
    }

    const allocated = [];
    let remaining = quantity;

    for (const item of inventoryItems) {
      if (remaining <= 0) break;
      
      const toDeduct = Math.min(item.quantity, remaining);
      const inventory = new Inventory(item);
      inventory.deduct(toDeduct);
      
      await storage.update('inventory', item.id, inventory.toJSON());
      
      allocated.push({
        inventoryId: item.id,
        batchNumber: item.batchNumber,
        quantity: toDeduct,
        expiryDate: item.expiryDate
      });
      
      remaining -= toDeduct;
    }

    if (remaining > 0) {
      throw new Error(`库存不足，还差 ${remaining} 单位`);
    }

    return allocated;
  }

  async createPrescription(prescriptionData, autoCalculate = true) {
    const prescription = new Prescription(prescriptionData);
    const validationErrors = prescription.validate();
    
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('; '));
    }

    for (let i = 0; i < prescription.medicines.length; i++) {
      const medicine = prescription.medicines[i];
      
      if (autoCalculate && medicine.medicineId) {
        try {
          const dosage = await this.calculateDosage(
            medicine.medicineId,
            prescription.species,
            prescription.weight,
            prescription.weightUnit
          );
          medicine.calculatedDosage = dosage;
          medicine.dosage = dosage.dosage;
          medicine.dosageUnit = dosage.unit;
          medicine.frequency = dosage.frequency;
        } catch (error) {
          prescription.addAnomaly('dosage_calculation', 
            `药品 ${medicine.medicineName || medicine.medicineId} 剂量计算失败: ${error.message}`, 
            'warning');
        }
      }

      if (medicine.dosage) {
        try {
          const inventoryCheck = await this.checkInventory(
            medicine.medicineId,
            medicine.dosage * (medicine.quantity || 1)
          );
          
          if (!inventoryCheck.available) {
            prescription.addAnomaly('inventory_shortage',
              `药品 ${medicine.medicineName || medicine.medicineId} 库存不足，需要 ${medicine.dosage}，可用 ${inventoryCheck.totalAvailable}`,
              'error');
          }

          if (inventoryCheck.expiringItems.length > 0) {
            prescription.addAnomaly('expiring_inventory',
              `药品 ${medicine.medicineName || medicine.medicineId} 有即将过期的库存`,
              'warning');
          }
        } catch (error) {
          prescription.addAnomaly('inventory_check',
            `药品 ${medicine.medicineName || medicine.medicineId} 库存检查失败: ${error.message}`,
            'warning');
        }
      }
    }

    return await storage.create('prescriptions', prescription.toJSON());
  }

  async reviewPrescription(prescriptionId, reviewer, notes = '', allocateInventory = false) {
    const prescriptionData = await storage.getById('prescriptions', prescriptionId);
    if (!prescriptionData) {
      throw new Error(`处方 ${prescriptionId} 不存在`);
    }

    const prescription = new Prescription(prescriptionData);
    prescription.review(reviewer, notes);

    if (allocateInventory) {
      for (const medicine of prescription.medicines) {
        if (medicine.dosage && medicine.medicineId) {
          try {
            const allocated = await this.allocateInventory(
              medicine.medicineId,
              medicine.dosage * (medicine.quantity || 1)
            );
            medicine.allocatedBatches = allocated;
          } catch (error) {
            prescription.addAnomaly('inventory_allocation',
              `药品 ${medicine.medicineName || medicine.medicineId} 库存分配失败: ${error.message}`,
              'error');
          }
        }
      }
    }

    prescription.dispense();

    return await storage.update('prescriptions', prescriptionId, prescription.toJSON());
  }

  async getPrescriptionHistory(filters = {}) {
    let prescriptions = await storage.getAll('prescriptions');

    if (filters.doctor) {
      prescriptions = prescriptions.filter(p => p.doctor === filters.doctor);
    }

    if (filters.reviewer) {
      prescriptions = prescriptions.filter(p => p.reviewedBy === filters.reviewer);
    }

    if (filters.status) {
      prescriptions = prescriptions.filter(p => p.status === filters.status);
    }

    if (filters.startDate) {
      prescriptions = prescriptions.filter(p => new Date(p.createdAt) >= new Date(filters.startDate));
    }

    if (filters.endDate) {
      prescriptions = prescriptions.filter(p => new Date(p.createdAt) <= new Date(filters.endDate));
    }

    if (filters.anomalyType) {
      prescriptions = prescriptions.filter(p => 
        p.anomalies && p.anomalies.some(a => a.type === filters.anomalyType));
    }

    if (filters.hasAnomalies) {
      prescriptions = prescriptions.filter(p => p.anomalies && p.anomalies.length > 0);
    }

    return prescriptions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  async getStatistics() {
    const prescriptions = await storage.getAll('prescriptions');
    const inventory = await storage.getAll('inventory');
    const medicines = await storage.getAll('medicines');

    const statusCounts = {};
    prescriptions.forEach(p => {
      statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    });

    const prescriptionsWithAnomalies = prescriptions.filter(p => 
      p.anomalies && p.anomalies.length > 0).length;

    const expiringInventory = inventory.filter(item => {
      const inv = new Inventory(item);
      return inv.daysUntilExpiry() <= 30;
    }).length;

    return {
      totalPrescriptions: prescriptions.length,
      statusCounts,
      prescriptionsWithAnomalies,
      totalMedicines: medicines.length,
      totalInventoryItems: inventory.length,
      expiringInventory
    };
  }

  async getInventorySummary() {
    const inventory = await storage.getAll('inventory');
    const medicines = await storage.getAll('medicines');

    const summary = {};
    
    for (const medicine of medicines) {
      const medicineInventory = inventory.filter(item => item.medicineId === medicine.id);
      const totalQuantity = medicineInventory.reduce((sum, item) => sum + item.quantity, 0);
      
      summary[medicine.id] = {
        medicineName: medicine.name,
        totalQuantity,
        unit: medicine.unit,
        batches: medicineInventory.length,
        expiring: medicineInventory.filter(item => {
          const inv = new Inventory(item);
          return inv.daysUntilExpiry() <= 30;
        }).length
      };
    }

    return summary;
  }
}

export default new PharmacyService();
