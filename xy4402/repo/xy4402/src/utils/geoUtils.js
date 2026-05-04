const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
};

const isPointNearStore = (pointLat, pointLon, storeLat, storeLon, thresholdKm = 0.5) => {
  const distance = calculateDistance(pointLat, pointLon, storeLat, storeLon);
  return distance <= thresholdKm;
};

const isTrackNearStore = (trackPoints, storeLat, storeLon, thresholdKm = 0.5) => {
  if (!trackPoints || trackPoints.length === 0) {
    return false;
  }
  
  for (const point of trackPoints) {
    if (point.latitude && point.longitude) {
      if (isPointNearStore(point.latitude, point.longitude, storeLat, storeLon, thresholdKm)) {
        return true;
      }
    }
  }
  
  return false;
};

const getTrackBounds = (trackPoints) => {
  if (!trackPoints || trackPoints.length === 0) {
    return null;
  }
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLon = Infinity, maxLon = -Infinity;
  
  for (const point of trackPoints) {
    if (point.latitude && point.longitude) {
      minLat = Math.min(minLat, point.latitude);
      maxLat = Math.max(maxLat, point.latitude);
      minLon = Math.min(minLon, point.longitude);
      maxLon = Math.max(maxLon, point.longitude);
    }
  }
  
  return {
    minLat, maxLat,
    minLon, maxLon,
    centerLat: (minLat + maxLat) / 2,
    centerLon: (minLon + maxLon) / 2
  };
};

module.exports = {
  calculateDistance,
  isPointNearStore,
  isTrackNearStore,
  getTrackBounds
};
