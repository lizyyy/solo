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
        color: z.color
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
    const view = this.activeViews.get(viewId);
    if (!view) {
      return { success: false, message: '视图不存在' };
    }

    const zone = this.temperatureZoneService.getZoneById(zoneId);
    if (!zone) {
      return { success: false, message: getUserFriendlyError('THREE_D_LINK_BROKEN') };
    }

    const sourceData = this._getSourceData(zone);
    
    if (sourceData.route && sourceData.route.needsLengthRecalculation()) {
      return {
        success: true,
        zone,
        sourceData,
        needsReview: true,
        message: getUserFriendlyError('ROUTE_LENGTH_NOT_RECALCULATED')
      };
    }

    return {
      success: true,
      zone,
      sourceData,
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

    return { success: true, layer, zone };
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

    const measurement = route.linkedMeasurementId 
      ? this.measurementService.getRecordById(route.linkedMeasurementId)
      : null;

    return { success: true, route, measurement, zone };
  }

  closeView(viewId) {
    return this.activeViews.delete(viewId);
  }

  _buildSourceLinks(zones) {
    const links = [];
    for (const zone of zones) {
      if (zone.layerId) {
        links.push({
          type: 'cad_layer',
          zoneId: zone.id,
          layerId: zone.layerId,
          description: `关联CAD图层: ${zone.layerId}`
        });
      }
      if (zone.routeId) {
        links.push({
          type: 'route',
          zoneId: zone.id,
          routeId: zone.routeId,
          description: `关联补录路线: ${zone.routeId}`
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
