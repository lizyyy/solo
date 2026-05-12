const CropTypes = {
  RICE: { name: '水稻', dailyWaterDemand: 8, icon: '🌾' },
  WHEAT: { name: '小麦', dailyWaterDemand: 4, icon: '🌾' },
  CORN: { name: '玉米', dailyWaterDemand: 6, icon: '🌽' },
  COTTON: { name: '棉花', dailyWaterDemand: 5, icon: '☁️' },
  VEGETABLE: { name: '蔬菜', dailyWaterDemand: 10, icon: '🥬' }
};

const PlotStatus = {
  IDLE: { name: '空闲', color: '#90EE90' },
  NEEDS_WATER: { name: '需水', color: '#FFA500' },
  BEING_IRRIGATED: { name: '灌溉中', color: '#4169E1' },
  IRRIGATED: { name: '已灌溉', color: '#00CED1' },
  WATER_SHORTAGE: { name: '缺水', color: '#FF6347' }
};

class Plot {
  constructor(id, x, y, cropType, area, slope, elevation) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.cropType = cropType;
    this.area = area;
    this.slope = slope;
    this.elevation = elevation;
    this.status = PlotStatus.NEEDS_WATER;
    this.irrigationOrder = null;
    this.allocatedWater = 0;
    this.waterShortage = 0;
    this.connectedCanal = null;
  }

  getWaterDemand() {
    return CropTypes[this.cropType].dailyWaterDemand * this.area;
  }

  getSlopeFactor() {
    return 1 + (this.slope / 100) * 0.5;
  }

  getAdjustedWaterDemand() {
    return this.getWaterDemand() * this.getSlopeFactor();
  }
}

class Canal {
  constructor(id, name, capacity, startX, startY, endX, endY) {
    this.id = id;
    this.name = name;
    this.capacity = capacity;
    this.startX = startX;
    this.startY = startY;
    this.endX = endX;
    this.endY = endY;
    this.connectedPlots = [];
    this.currentFlow = 0;
    this.flowDirection = 'horizontal';
  }

  addPlot(plot) {
    this.connectedPlots.push(plot);
    plot.connectedCanal = this;
  }

  getRemainingCapacity() {
    return this.capacity - this.currentFlow;
  }

  getUtilizationRate() {
    return (this.currentFlow / this.capacity) * 100;
  }
}

class IrrigationSystem {
  constructor() {
    this.plots = [];
    this.canals = [];
    this.irrigationSchedule = [];
    this.totalWaterDemand = 0;
    this.totalWaterAvailable = 0;
    this.totalWaterShortage = 0;
    this.irrigatedCount = 0;
    this.waterShortageCount = 0;
  }

  addPlot(plot) {
    this.plots.push(plot);
  }

  addCanal(canal) {
    this.canals.push(canal);
  }

  calculateTotalWaterDemand() {
    this.totalWaterDemand = this.plots.reduce((sum, plot) => sum + plot.getAdjustedWaterDemand(), 0);
    return this.totalWaterDemand;
  }

  calculateTotalCanalCapacity() {
    this.totalWaterAvailable = this.canals.reduce((sum, canal) => sum + canal.capacity, 0);
    return this.totalWaterAvailable;
  }

  runIrrigation() {
    this.reset();
    this.calculateTotalWaterDemand();
    this.calculateTotalCanalCapacity();

    const sortedPlots = [...this.plots].sort((a, b) => {
      if (a.elevation !== b.elevation) return a.elevation - b.elevation;
      if (a.slope !== b.slope) return b.slope - a.slope;
      return b.getAdjustedWaterDemand() - a.getAdjustedWaterDemand();
    });

    let order = 1;
    const canalPlotsMap = new Map();

    this.canals.forEach(canal => {
      canalPlotsMap.set(canal.id, []);
    });

    sortedPlots.forEach(plot => {
      if (plot.connectedCanal) {
        canalPlotsMap.get(plot.connectedCanal.id).push(plot);
      }
    });

    let globalOrder = 1;
    const maxPlotsPerCanal = Math.max(...Array.from(canalPlotsMap.values()).map(p => p.length));

    for (let round = 0; round < maxPlotsPerCanal; round++) {
      for (const [canalId, canalPlots] of canalPlotsMap.entries()) {
        if (round < canalPlots.length) {
          const plot = canalPlots[round];
          const canal = this.canals.find(c => c.id === canalId);
          const demand = plot.getAdjustedWaterDemand();

          if (canal.getRemainingCapacity() >= demand) {
            plot.allocatedWater = demand;
            plot.waterShortage = 0;
            plot.status = PlotStatus.IRRIGATED;
            plot.irrigationOrder = globalOrder++;
            canal.currentFlow += demand;
            this.irrigatedCount++;
          } else {
            plot.allocatedWater = canal.getRemainingCapacity();
            plot.waterShortage = demand - plot.allocatedWater;
            plot.status = PlotStatus.WATER_SHORTAGE;
            plot.irrigationOrder = globalOrder++;
            canal.currentFlow += plot.allocatedWater;
            this.waterShortageCount++;
            this.totalWaterShortage += plot.waterShortage;
          }

          this.irrigationSchedule.push({
            order: plot.irrigationOrder,
            plotId: plot.id,
            canalId: canal.id,
            waterAllocated: plot.allocatedWater,
            waterShortage: plot.waterShortage,
            status: plot.status
          });
        }
      }
    }

    return {
      schedule: this.irrigationSchedule,
      irrigatedCount: this.irrigatedCount,
      waterShortageCount: this.waterShortageCount,
      totalWaterDemand: this.totalWaterDemand,
      totalWaterAvailable: this.totalWaterAvailable,
      totalWaterShortage: this.totalWaterShortage
    };
  }

  reset() {
    this.plots.forEach(plot => {
      plot.status = PlotStatus.NEEDS_WATER;
      plot.irrigationOrder = null;
      plot.allocatedWater = 0;
      plot.waterShortage = 0;
    });

    this.canals.forEach(canal => {
      canal.currentFlow = 0;
    });

    this.irrigationSchedule = [];
    this.totalWaterDemand = 0;
    this.totalWaterAvailable = 0;
    this.totalWaterShortage = 0;
    this.irrigatedCount = 0;
    this.waterShortageCount = 0;
  }

  exportResults() {
    return {
      timestamp: new Date().toISOString(),
      params: {
        plotCount: this.plots.length,
        canalCount: this.canals.length
      },
      statistics: {
        totalWaterDemand: this.totalWaterDemand,
        totalWaterAvailable: this.totalWaterAvailable,
        totalWaterShortage: this.totalWaterShortage,
        irrigatedCount: this.irrigatedCount,
        waterShortageCount: this.waterShortageCount
      },
      plots: this.plots.map(p => ({
        id: p.id,
        cropType: CropTypes[p.cropType].name,
        area: p.area,
        slope: p.slope,
        elevation: p.elevation,
        waterDemand: p.getAdjustedWaterDemand(),
        allocatedWater: p.allocatedWater,
        waterShortage: p.waterShortage,
        status: p.status.name,
        irrigationOrder: p.irrigationOrder,
        canal: p.connectedCanal ? p.connectedCanal.name : null
      })),
      canals: this.canals.map(c => ({
        id: c.id,
        name: c.name,
        capacity: c.capacity,
        currentFlow: c.currentFlow,
        utilizationRate: c.getUtilizationRate(),
        connectedPlots: c.connectedPlots.map(p => p.id)
      })),
      schedule: this.irrigationSchedule
    };
  }

  checkConsistency(previousExport) {
    if (!previousExport) return { consistent: true, message: '无历史数据对比' };

    const currentExport = this.exportResults();
    const inconsistencies = [];

    if (currentExport.statistics.totalWaterDemand !== previousExport.statistics.totalWaterDemand) {
      inconsistencies.push(`总需水量不一致: 当前 ${currentExport.statistics.totalWaterDemand}, 历史 ${previousExport.statistics.totalWaterDemand}`);
    }

    if (currentExport.statistics.totalWaterShortage !== previousExport.statistics.totalWaterShortage) {
      inconsistencies.push(`总缺水量不一致: 当前 ${currentExport.statistics.totalWaterShortage}, 历史 ${previousExport.statistics.totalWaterShortage}`);
    }

    if (currentExport.statistics.irrigatedCount !== previousExport.statistics.irrigatedCount) {
      inconsistencies.push(`已灌溉地块数不一致: 当前 ${currentExport.statistics.irrigatedCount}, 历史 ${previousExport.statistics.irrigatedCount}`);
    }

    if (currentExport.schedule.length !== previousExport.schedule.length) {
      inconsistencies.push(`轮灌计划长度不一致`);
    } else {
      for (let i = 0; i < currentExport.schedule.length; i++) {
        if (currentExport.schedule[i].plotId !== previousExport.schedule[i].plotId) {
          inconsistencies.push(`第 ${i + 1} 轮灌顺序不一致`);
          break;
        }
      }
    }

    return {
      consistent: inconsistencies.length === 0,
      message: inconsistencies.length === 0 ? '结果一致' : inconsistencies.join('; '),
      inconsistencies
    };
  }
}
