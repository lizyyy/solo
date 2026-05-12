const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const store = require('../store');

class BusRouteService {
  getRoutes(filters = {}) {
    let results = Array.from(store.busRoutes.values());

    if (filters.status) {
      results = results.filter(r => r.status === filters.status);
    }
    if (filters.routeNumber) {
      results = results.filter(r => r.routeNumber === filters.routeNumber);
    }

    return { success: true, data: results };
  }

  getRouteById(routeId) {
    const route = store.busRoutes.get(routeId);
    if (!route) {
      return { success: false, error: '校车线路不存在' };
    }

    const requests = Array.from(store.temporaryStopRequests.values())
      .filter(r => r.routeId === routeId);

    const stops = Array.from(store.studentStops.values())
      .filter(s => s.routeId === routeId);

    return { success: true, data: { ...route, temporaryStopRequests: requests, studentStops: stops } };
  }

  createRoute(data) {
    const { routeNumber, routeName, driverName, licensePlate, scheduledStops } = data;
    
    const routeId = uuidv4();
    const stops = scheduledStops.map(stop => ({
      ...stop,
      stopId: uuidv4(),
      order: stop.order || (scheduledStops.indexOf(stop) + 1)
    }));

    const route = {
      id: routeId,
      routeNumber,
      routeName,
      driverName,
      licensePlate,
      status: 'active',
      scheduledStops: stops,
      createdAt: moment().toISOString(),
      updatedAt: moment().toISOString()
    };

    store.busRoutes.set(routeId, route);
    return { success: true, data: route };
  }
}

module.exports = new BusRouteService();