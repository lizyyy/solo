const fs = require('fs-extra');
const path = require('path');
const { Vehicle, PreparationItem, Cost, PriceAdjustment } = require('../models/Vehicle');

class DataStore {
  constructor(dataDir = null) {
    this.dataDir = dataDir || path.join(process.cwd(), 'data');
    this.vehiclesFile = path.join(this.dataDir, 'vehicles.json');
    this.vehicles = [];
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    await fs.ensureDir(this.dataDir);
    await this.load();
    this._initialized = true;
  }

  async load() {
    if (await fs.pathExists(this.vehiclesFile)) {
      const data = await fs.readJson(this.vehiclesFile, { throws: false }) || [];
      this.vehicles = data.map(item => Vehicle.fromJSON(item));
    } else {
      this.vehicles = [];
    }
  }

  async save() {
    await fs.ensureDir(this.dataDir);
    const data = this.vehicles.map(vehicle => vehicle.toJSON());
    await fs.writeJson(this.vehiclesFile, data, { spaces: 2 });
  }

  addVehicle(vehicleData) {
    const vehicle = new Vehicle(vehicleData);
    this.vehicles.push(vehicle);
    return vehicle;
  }

  getVehicleById(id) {
    return this.vehicles.find(v => v.id === id);
  }

  getVehicleByVin(vin) {
    return this.vehicles.find(v => v.vin === vin);
  }

  getVehicleByPlate(plateNumber) {
    return this.vehicles.find(v => v.plateNumber === plateNumber);
  }

  getAllVehicles() {
    return [...this.vehicles];
  }

  addPreparationItem(vehicleId, itemData) {
    const vehicle = this.getVehicleById(vehicleId);
    if (!vehicle) {
      throw new Error(`未找到车辆 ID: ${vehicleId}`);
    }
    const item = new PreparationItem(itemData);
    vehicle.addPreparationItem(item);
    return item;
  }

  addCost(vehicleId, costData) {
    const vehicle = this.getVehicleById(vehicleId);
    if (!vehicle) {
      throw new Error(`未找到车辆 ID: ${vehicleId}`);
    }
    const cost = new Cost({ ...costData, vehicleId });
    vehicle.addCost(cost);
    return cost;
  }

  addPriceAdjustment(vehicleId, adjustmentData) {
    const vehicle = this.getVehicleById(vehicleId);
    if (!vehicle) {
      throw new Error(`未找到车辆 ID: ${vehicleId}`);
    }
    
    const currentPrice = vehicle.getCurrentSellingPrice();
    const adjustment = new PriceAdjustment({
      ...adjustmentData,
      vehicleId,
      oldPrice: currentPrice
    });
    vehicle.addPriceAdjustment(adjustment);
    return adjustment;
  }

  updateVehicleStatus(vehicleId, status) {
    const vehicle = this.getVehicleById(vehicleId);
    if (!vehicle) {
      throw new Error(`未找到车辆 ID: ${vehicleId}`);
    }
    vehicle.status = status;
    return vehicle;
  }

  getVehiclesWithIssues() {
    return this.vehicles.filter(v => v.hasIssues());
  }

  getVehiclesForSale() {
    return this.vehicles.filter(v => v.status === 'for_sale');
  }

  getVehiclesInPreparation() {
    return this.vehicles.filter(v => v.status === 'in_preparation');
  }

  getVehiclesSortedByProfit(ascending = false) {
    const sorted = [...this.vehicles].sort((a, b) => {
      return b.getProfit() - a.getProfit();
    });
    return ascending ? sorted.reverse() : sorted;
  }

  getVehiclesSortedByProfitMargin(ascending = false) {
    const sorted = [...this.vehicles].sort((a, b) => {
      return b.getProfitMargin() - a.getProfitMargin();
    });
    return ascending ? sorted.reverse() : sorted;
  }

  getStatistics() {
    const totalVehicles = this.vehicles.length;
    const totalPurchaseCost = this.vehicles.reduce((sum, v) => sum + v.purchasePrice, 0);
    const totalPreparationCost = this.vehicles.reduce((sum, v) => sum + v.getTotalPreparationCost(), 0);
    const totalCost = totalPurchaseCost + totalPreparationCost;
    const totalExpectedRevenue = this.vehicles.reduce((sum, v) => sum + v.getCurrentSellingPrice(), 0);
    const totalProfit = totalExpectedRevenue - totalCost;
    const vehiclesWithIssues = this.getVehiclesWithIssues().length;
    const vehiclesForSale = this.getVehiclesForSale().length;
    const vehiclesInPreparation = this.getVehiclesInPreparation().length;

    return {
      totalVehicles,
      totalPurchaseCost,
      totalPreparationCost,
      totalCost,
      totalExpectedRevenue,
      totalProfit,
      profitMargin: totalCost > 0 ? (totalProfit / totalCost) * 100 : 0,
      vehiclesWithIssues,
      vehiclesForSale,
      vehiclesInPreparation
    };
  }
}

module.exports = DataStore;
