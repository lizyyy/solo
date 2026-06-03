const { CADLayerService } = require('./services/CADLayerService');
const { MeasurementService } = require('./services/MeasurementService');
const { TemperatureZoneService } = require('./services/TemperatureZoneService');
const { VisualizationService } = require('./services/VisualizationService');
const { ExportService } = require('./services/ExportService');
const { getUserFriendlyError } = require('./utils/errors');

class ColdChainTemperatureZone3D {
  constructor() {
    this.cadLayerService = new CADLayerService();
    this.measurementService = new MeasurementService();
    this.temperatureZoneService = new TemperatureZoneService();
    this.visualizationService = new VisualizationService(
      this.cadLayerService,
      this.measurementService,
      this.temperatureZoneService
    );
    this.exportService = new ExportService(
      this.measurementService,
      this.temperatureZoneService
    );
  }

  getUserFriendlyError(errorCode, details) {
    return getUserFriendlyError(errorCode, details);
  }

  getBoundaryRules() {
    return this.temperatureZoneService.getBoundaryRules();
  }
}

module.exports = { ColdChainTemperatureZone3D };

if (require.main === module) {
  console.log('冷链库温区三维分层系统启动...');
  console.log('边界规则:', JSON.stringify(new ColdChainTemperatureZone3D().getBoundaryRules(), null, 2));
}
