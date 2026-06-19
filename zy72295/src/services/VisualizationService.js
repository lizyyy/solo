const { getUserFriendlyError } = require('../utils/errors');

class VisualizationService {
  constructor(cadLayerService, measurementService, temperatureZoneService) {
    this.cadLayerService = cadLayerService;
    this.measurementService = measurementService;
    this.temperatureZoneService = temperatureZoneService;
    this.activeViews = new Map();
  }

  create3DView(zoneIds, viewType = '3d') {
    const zones = zoneIds.map(id => this.temperatureZoneService.getZoneById(id)).filter(Boolean);

    if (zones.length === 0) {
      return { success: false, message: '未找到有效的温区数据' };
    }

    const viewId = `view_${Date.now()}`;
    const viewData = {
      id: viewId,
      type: viewType,
      createdAt: new Date().toISOString(),
      zones: zones.map(z => ({
        id: z.id,
        name: z.name,
        layerId: z.layerId,
        routeId: z.routeId,
        bounds: z.bounds,
        temperatureRange: z.temperatureRange,
        color: z.color,
        status: z.status,
        remark: z.remark
      })),
      sourceLinks: this._buildSourceLinks(zones)
    };

    this.activeViews.set(viewId, viewData);
    return { success: true, view: viewData };
  }

  getView(viewId) {
    return this.activeViews.get(viewId) || null;
  }

  clickZoneInView(viewId, zoneId) {
    const zone = this.temperatureZoneService.getZoneById(zoneId);
    if (!zone) {
      return { success: false, message: getUserFriendlyError('THREE_D_LINK_BROKEN') };
    }

    const sourceData = this._getSourceData(zone);
    const zoneSummary = this.temperatureZoneService.getZoneSummary(zoneId);

    const view = this.activeViews.get(viewId);
    const viewInfo = view ? { viewId: view.id, viewType: view.type } : null;

    if (sourceData.route && sourceData.route.needsLengthRecalculation()) {
      return {
        success: true,
        zone,
        zoneSummary,
        sourceData,
        viewInfo,
        needsReview: true,
        reviewContext: {
          issue: getUserFriendlyError('ROUTE_LENGTH_NOT_RECALCULATED'),
          originalValue: { lengthRecalculated: false },
          changedValue: null,
          nextStep: '请回到CAD图层或测距仪记录重新确认'
        },
        message: getUserFriendlyError('ROUTE_LENGTH_NOT_RECALCULATED')
      };
    }

    if (sourceData.route && sourceData.route.needsCustomerReview) {
      return {
        success: true,
        zone,
        zoneSummary,
        sourceData,
        viewInfo,
        needsReview: true,
        reviewContext: {
          issue: '该路线正处于客户复核中，请勿提前归为正常',
          originalValue: { customerReviewStatus: 'pending' },
          changedValue: null,
          nextStep: '等待展陈客户复核完成'
        },
        message: getUserFriendlyError('DATA_NEEDS_REVIEW')
      };
    }

    return {
      success: true,
      zone,
      zoneSummary,
      sourceData,
      viewInfo,
      needsReview: false
    };
  }

  navigateToCADLayer(viewId, zoneId) {
    const zone = this.temperatureZoneService.getZoneById(zoneId);
    if (!zone || !zone.layerId) {
      return { success: false, message: getUserFriendlyError('THREE_D_LINK_BROKEN') };
    }

    const layer = this.cadLayerService.getLayerById(zone.layerId);
    if (!layer) {
      return { success: false, message: getUserFriendlyError('THREE_D_LINK_BROKEN') };
    }

    const layerDetail = this.cadLayerService.getLayerDetail(zone.layerId);

    return { success: true, layer, layerDetail, zone };
  }

  navigateToMeasurement(viewId, zoneId) {
    const zone = this.temperatureZoneService.getZoneById(zoneId);
    if (!zone || !zone.routeId) {
      return { success: false, message: getUserFriendlyError('THREE_D_LINK_BROKEN') };
    }

    const route = this.measurementService.getRouteById(zone.routeId);
    if (!route) {
      return { success: false, message: getUserFriendlyError('THREE_D_LINK_BROKEN') };
    }

    const routeDetail = this.measurementService.getRouteDetail(zone.routeId);

    return { success: true, route, routeDetail, zone };
  }

  closeView(viewId) {
    return this.activeViews.delete(viewId);
  }

  _buildSourceLinks(zones) {
    const links = [];
    for (const zone of zones) {
      if (zone.layerId) {
        const layer = this.cadLayerService.getLayerById(zone.layerId);
        links.push({
          type: 'cad_layer',
          zoneId: zone.id,
          layerId: zone.layerId,
          layerName: layer ? layer.name : '未知图层',
          description: `关联CAD图层: ${layer ? layer.name : zone.layerId}`
        });
      }
      if (zone.routeId) {
        const route = this.measurementService.getRouteById(zone.routeId);
        links.push({
          type: 'route',
          zoneId: zone.id,
          routeId: zone.routeId,
          routeName: route ? route.name : '未知路线',
          description: `关联补录路线: ${route ? route.name : zone.routeId}`
        });
      }
    }
    return links;
  }

  _getSourceData(zone) {
    const layer = zone.layerId ? this.cadLayerService.getLayerById(zone.layerId) : null;
    const route = zone.routeId ? this.measurementService.getRouteById(zone.routeId) : null;
    const measurement = route?.linkedMeasurementId
      ? this.measurementService.getRecordById(route.linkedMeasurementId)
      : null;

    return { layer, route, measurement };
  }
}

module.exports = { VisualizationService };
