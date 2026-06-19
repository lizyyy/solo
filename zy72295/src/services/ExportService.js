const fs = require('fs');
const path = require('path');
const Jimp = require('jimp');
const { v4: uuidv4 } = require('uuid');
const { getUserFriendlyError } = require('../utils/errors');
const { store, EXPORT_IMG_DIR } = require('../store/FileStore');
const { temperatureZoneService } = require('./TemperatureZoneService');
const { measurementService } = require('./MeasurementService');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

class ExportService {
  constructor() {
    ensureDir(EXPORT_IMG_DIR);
  }

  canExportScreenshot() {
    const pendingRoutes = measurementService.getRoutesPendingReview();
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

    const allZones = temperatureZoneService.getAllZones();
    const zonesWithIssues = allZones.filter(z => {
      const summary = temperatureZoneService.getZoneSummary(z.id);
      if (!summary) return false;
      const lastNonCreate = summary.latestOperation?.operation !== 'create' && summary.latestOperation?.context?.reviewRequired;
      return false;
    });

    return { canExport: true };
  }

  async exportScreenshot(viewId, exporter, options = {}) {
    const checkResult = this.canExportScreenshot();
    if (!checkResult.canExport) {
      return {
        success: false,
        ...checkResult
      };
    }

    const zoneIds = options.zoneIds || temperatureZoneService.getAllZones().map(z => z.id);
    const zones = zoneIds.map(id => temperatureZoneService.getZoneById(id)).filter(Boolean);

    const timestamp = Date.now();
    const fileName = `export_${timestamp}.png`;
    const filePath = path.join(EXPORT_IMG_DIR, fileName);
    const relativePath = `/exports/${fileName}`;

    await this._generateScreenshotImage(zones, filePath, exporter);

    const zoneSummaries = zones.map(z => temperatureZoneService.getZoneSummary(z.id));
    const allRoutes = measurementService.getAllRoutes();
    const routeSummaries = allRoutes.map(r => measurementService.getRouteSummary(r.id));

    const exportRecord = {
      id: uuidv4(),
      viewId: viewId || `view_${timestamp}`,
      exportedBy: exporter,
      exportedAt: new Date().toISOString(),
      status: 'completed',
      format: 'png',
      fileName,
      filePath,
      relativePath,
      fileSize: fs.existsSync(filePath) ? fs.statSync(filePath).size : 0,
      zoneIds: zones.map(z => z.id),
      zoneCount: zones.length,
      routeCount: allRoutes.length,
      snapshot: {
        zones: zoneSummaries,
        routes: routeSummaries,
        exportedAt: new Date().toISOString()
      }
    };

    store.add('exports', exportRecord);

    return {
      success: true,
      export: exportRecord,
      message: '截图导出成功'
    };
  }

  async _generateScreenshotImage(zones, filePath, exporter) {
    const width = 1200;
    const height = 800;
    const image = new Jimp(width, height, 0xf5f7faFF);

    const font = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
    const font16 = await Jimp.loadFont(Jimp.FONT_SANS_16_BLACK);
    const font14 = await Jimp.loadFont(Jimp.FONT_SANS_14_BLACK);

    image.scan(0, 0, width, 80, function (x, y, idx) {
      this.bitmap.data[idx + 0] = 44;
      this.bitmap.data[idx + 1] = 62;
      this.bitmap.data[idx + 2] = 80;
      this.bitmap.data[idx + 3] = 255;
    });

    image.print(font, 40, 24, '冷链库温区三维分层 - 导出截图');

    const subtitle = `导出时间: ${new Date().toLocaleString('zh-CN')}  |  操作人: ${exporter}  |  温区数: ${zones.length}`;
    image.print(font14, 40, 60, subtitle);

    const leftPanelX = 40;
    const leftPanelY = 110;
    const panelWidth = 400;
    const panelHeight = 640;

    this._drawRoundRect(image, leftPanelX, leftPanelY, panelWidth, panelHeight, 8, 0xffffffff);
    image.print(font16, leftPanelX + 20, leftPanelY + 16, '温区列表');

    let yOffset = leftPanelY + 56;
    for (let i = 0; i < zones.length && yOffset < leftPanelY + panelHeight - 40; i++) {
      const zone = zones[i];
      const colorHex = this._hexToRgb(zone.color || '#3498db');

      image.scan(leftPanelX + 20, yOffset, 16, 16, function (x, y, idx) {
        this.bitmap.data[idx + 0] = colorHex.r;
        this.bitmap.data[idx + 1] = colorHex.g;
        this.bitmap.data[idx + 2] = colorHex.b;
        this.bitmap.data[idx + 3] = 255;
      });

      const nameText = `${zone.name || '未命名温区'}`;
      image.print(font14, leftPanelX + 45, yOffset - 2, nameText);

      const tempText = `温度: ${zone.temperatureRange?.min ?? '-'}°C ~ ${zone.temperatureRange?.max ?? '-'}°C`;
      image.print(font14, leftPanelX + 45, yOffset + 16, tempText);

      const statusText = `状态: ${this._getStatusLabel(zone.status)}`;
      image.print(font14, leftPanelX + 45, yOffset + 34, statusText);

      yOffset += 66;
    }

    const viewX = 480;
    const viewY = 110;
    const viewWidth = 680;
    const viewHeight = 500;

    this._drawRoundRect(image, viewX, viewY, viewWidth, viewHeight, 8, 0xe8f4fdFF);
    image.print(font16, viewX + 20, viewY + 16, '温区俯视图 (冷链库 100m × 100m)');

    const plotLeft = viewX + 40;
    const plotTop = viewY + 60;
    const plotWidth = viewWidth - 80;
    const plotHeight = viewHeight - 100;

    this._drawRoundRect(image, plotLeft, plotTop, plotWidth, plotHeight, 4, 0xffffffff);

    const { minX = 0, maxX = 100, minY = 0, maxY = 100 } = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    const scaleX = plotWidth / (maxX - minX);
    const scaleY = plotHeight / (maxY - minY);

    for (const zone of zones) {
      const b = zone.bounds;
      if (!b) continue;

      const zx = plotLeft + (b.minX - minX) * scaleX;
      const zy = plotTop + (b.minY - minY) * scaleY;
      const zw = (b.maxX - b.minX) * scaleX;
      const zh = (b.maxY - b.minY) * scaleY;

      const colorHex = this._hexToRgb(zone.color || '#3498db');

      for (let px = 0; px < zw; px++) {
        for (let py = 0; py < zh; py++) {
          const ix = Math.floor(zx + px);
          const iy = Math.floor(zy + py);
          if (ix >= plotLeft && ix < plotLeft + plotWidth && iy >= plotTop && iy < plotTop + plotHeight) {
            const idx = (iy * image.bitmap.width + ix) * 4;
            image.bitmap.data[idx + 0] = colorHex.r;
            image.bitmap.data[idx + 1] = colorHex.g;
            image.bitmap.data[idx + 2] = colorHex.b;
            image.bitmap.data[idx + 3] = 180;
          }
        }
      }

      image.scan(Math.floor(zx), Math.floor(zy), Math.floor(Math.max(1, zw)), 1, function (x, y, idx) {
        this.bitmap.data[idx + 0] = colorHex.r;
        this.bitmap.data[idx + 1] = colorHex.g;
        this.bitmap.data[idx + 2] = colorHex.b;
        this.bitmap.data[idx + 3] = 255;
      });
    }

    const infoY = viewY + viewHeight + 20;
    image.print(font14, viewX + 20, infoY, `X轴范围: ${minX}m - ${maxX}m  |  Y轴范围: ${minY}m - ${maxY}m`);
    image.print(font14, viewX + 20, infoY + 22, '点击温区可追溯到CAD图层和测距仪记录');

    const footY = height - 40;
    image.print(font14, 40, footY, '冷链库温区三维分层系统 - 导出图片可作为展陈客户复核存档');

    await image.writeAsync(filePath);
    return filePath;
  }

  _drawRoundRect(image, x, y, w, h, r, color) {
    for (let px = 0; px < w; px++) {
      for (let py = 0; py < h; py++) {
        const ix = Math.floor(x + px);
        const iy = Math.floor(y + py);
        const cornerDist = Math.min(
          px < r && py < r ? Math.sqrt((r - px) ** 2 + (r - py) ** 2) : 0,
          px >= w - r && py < r ? Math.sqrt((px - (w - r)) ** 2 + (r - py) ** 2) : 0,
          px < r && py >= h - r ? Math.sqrt((r - px) ** 2 + (py - (h - r)) ** 2) : 0,
          px >= w - r && py >= h - r ? Math.sqrt((px - (w - r)) ** 2 + (py - (h - r)) ** 2) : 0
        );
        if (cornerDist > r) continue;

        const idx = (iy * image.bitmap.width + ix) * 4;
        const rByte = (color >> 24) & 0xff;
        const gByte = (color >> 16) & 0xff;
        const bByte = (color >> 8) & 0xff;
        const aByte = color & 0xff;
        image.bitmap.data[idx + 0] = rByte;
        image.bitmap.data[idx + 1] = gByte;
        image.bitmap.data[idx + 2] = bByte;
        image.bitmap.data[idx + 3] = aByte;
      }
    }
  }

  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 52, g: 152, b: 219 };
  }

  _getStatusLabel(status) {
    const map = {
      draft: '草稿',
      reviewing: '待复核',
      normal: '正常',
      rejected: '已拒绝'
    };
    return map[status] || status || '未知';
  }

  checkWorkflowStep(step) {
    switch (step) {
      case 'cad_import':
        return { canProceed: true, message: 'CAD图层导入完成' };

      case 'measurement_review': {
        const pendingRoutes = measurementService.getRoutesPendingReview();
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
    return [...store.getAll('exports')]
      .sort((a, b) => new Date(b.exportedAt) - new Date(a.exportedAt))
      .slice(0, limit);
  }

  getExportById(id) {
    return store.getById('exports', id);
  }
}

const exportService = new ExportService();

module.exports = { ExportService, exportService };
