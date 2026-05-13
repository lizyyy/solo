const { generateId, getCurrentTime } = require('../utils/idGenerator');

const trackPoints = new Map();
const orderTrackPoints = new Map();

class TrackPoint {
  constructor(data) {
    this.id = data.id || generateId('track');
    this.orderId = data.orderId;
    this.riderId = data.riderId;
    this.latitude = data.latitude;
    this.longitude = data.longitude;
    this.timestamp = data.timestamp || getCurrentTime();
    this.speed = data.speed || null;
    this.isOnline = data.isOnline !== undefined ? data.isOnline : true;
    this.locationHash = `${data.orderId}_${data.riderId}_${data.latitude}_${data.longitude}_${Math.floor(data.timestamp / 60000)}`;
  }

  static create(data) {
    const trackPoint = new TrackPoint(data);
    trackPoints.set(trackPoint.id, trackPoint);
    
    if (!orderTrackPoints.has(data.orderId)) {
      orderTrackPoints.set(data.orderId, []);
    }
    orderTrackPoints.get(data.orderId).push(trackPoint);
    
    return trackPoint;
  }

  static findByOrderId(orderId) {
    return orderTrackPoints.get(orderId) || [];
  }

  static findByOrderIdAndRiderId(orderId, riderId) {
    const points = orderTrackPoints.get(orderId) || [];
    return points.filter(p => p.riderId === riderId);
  }

  static findLatestByOrderIdAndRiderId(orderId, riderId) {
    const points = TrackPoint.findByOrderIdAndRiderId(orderId, riderId);
    if (points.length === 0) return null;
    return points.reduce((latest, point) => 
      point.timestamp > latest.timestamp ? point : latest
    );
  }

  static isDuplicate(data) {
    const points = orderTrackPoints.get(data.orderId) || [];
    const locationHash = `${data.orderId}_${data.riderId}_${data.latitude}_${data.longitude}_${Math.floor((data.timestamp || getCurrentTime()) / 60000)}`;
    return points.some(p => p.locationHash === locationHash);
  }
}

module.exports = TrackPoint;
