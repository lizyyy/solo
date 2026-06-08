const { getUserFriendlyError } = require('../utils/errors');

class ExportService {
  constructor(measurementService, temperatureZoneService) {
    this.measurementService = measurementService;
    this.temperatureZoneService = temperatureZoneService;
    this.exportHistory = [];
  }

  canExportScreenshot() {
    const pendingRoutes = this.measurementService.getRoutesPendingReview();
    if (pendingRoutes.length > 0) {
      return {
        canExport: false,
        message: getUserFriendlyError('EXPORT_FAILED_CUSTOMER_REVIEW'),
        pendingRoutes: pendingRoutes.map(r => ({
          id: r.id,
          name: r.name,
          customerReviewStatus: r.customerReviewStatus,
          nextStep: r.needsCustomerReview ? '请联系展陈客户完成复核' : '无需复核'
        }))
      };
    }

    const allZones = this.temperatureZoneService.getAllZones();
    const zonesNeedingReview = allZones.filter(z => {
      const summary = this.temperatureZoneService.getZoneSummary(z.id);
      return summary && summary.hasPendingReview;
    });

    if (zonesNeedingReview.length > 0) {
      return {
        canExport: false,
        message: getUserFriendlyError('DATA_NEEDS_REVIEW'),
        pendingZones: zonesNeedingReview.map(z => ({ id: z.id, name: z.name }))
      };
    }

    return { canExport: true };
  }

  exportScreenshot(viewId, exporter) {
    const checkResult = this.canExportScreenshot();
    if (!checkResult.canExport) {
      return {
        success: false,
        ...checkResult
      };
    }

    const exportRecord = {
      id: `export_${Date.now()}`,
      viewId,
      exportedBy: exporter,
      exportedAt: new Date().toISOString(),
      status: 'completed',
      format: 'png'
    };

    this.exportHistory.push(exportRecord);
    return {
      success: true,
      export: exportRecord,
      message: '截图导出成功'
    };
  }

  checkWorkflowStep(step) {
    switch (step) {
      case 'cad_import':
        return { canProceed: true, message: 'CAD图层导入完成' };

      case 'measurement_review': {
        const pendingRoutes = this.measurementService.getRoutesPendingReview();
        if (pendingRoutes.length > 0) {
          return {
            canProceed: false,
            message: getUserFriendlyError('DATA_NEEDS_REVIEW'),
            pendingRoutes: pendingRoutes.map(r => ({
              id: r.id,
              name: r.name,
              customerReviewStatus: r.customerReviewStatus,
              context: '等待展陈客户复核，请勿提前归为正常'
            }))
          };
        }
        return { canProceed: true, message: '测距仪记录复核完成' };
      }

      case 'export':
        return this.canExportScreenshot();

      default:
        return { canProceed: true };
    }
  }

  runFullWorkflow(operator) {
    const workflow = {
      steps: [
        { name: 'cad_import', status: 'pending' },
        { name: 'measurement_review', status: 'pending' },
        { name: 'export', status: 'pending' }
      ],
      startedAt: new Date().toISOString(),
      operator
    };

    for (const step of workflow.steps) {
      const check = this.checkWorkflowStep(step.name);
      if (check.canProceed) {
        step.status = 'completed';
      } else {
        step.status = 'blocked';
        step.message = check.message;
        step.blockingItems = check.pendingRoutes || check.pendingZones || [];
        workflow.status = 'blocked';
        return { success: false, workflow, message: check.message };
      }
    }

    workflow.status = 'completed';
    workflow.completedAt = new Date().toISOString();
    return { success: true, workflow };
  }

  getExportHistory(limit = 10) {
    return [...this.exportHistory]
      .sort((a, b) => new Date(b.exportedAt) - new Date(a.exportedAt))
      .slice(0, limit);
  }
}

module.exports = { ExportService };
