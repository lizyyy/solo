const EARTH_RADIUS = 6371000;

function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return EARTH_RADIUS * c;
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = toRadians(lng2 - lng1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x);
  bearing = (bearing * 180 / Math.PI + 360) % 360;
  
  return bearing;
}

function getDirectionFromBearing(bearing) {
  const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index];
}

function generateDriftNoise(baseLat, baseLng, accuracy, driftMultiplier = 1.0) {
  const metersPerDegreeLat = 111000;
  const metersPerDegreeLng = 111000 * Math.cos(toRadians(baseLat));
  
  const baseDrift = accuracy * 0.3;
  const actualDrift = baseDrift * driftMultiplier;
  
  const angle = Math.random() * 2 * Math.PI;
  const distance = Math.random() * actualDrift;
  
  const latOffset = (Math.cos(angle) * distance) / metersPerDegreeLat;
  const lngOffset = (Math.sin(angle) * distance) / metersPerDegreeLng;
  
  return {
    noisyLat: baseLat + latOffset,
    noisyLng: baseLng + lngOffset,
    driftAmount: distance,
    driftAngle: angle * 180 / Math.PI
  };
}

function calculateDriftLevel(accuracy, distanceToInterference = null) {
  if (accuracy > 30) return 'high';
  if (accuracy > 15) return 'medium';
  return 'normal';
}

function detectSuspiciousJump(prevSample, currentSample, speedThreshold = 100) {
  if (!prevSample) return false;
  
  const distance = calculateDistance(
    prevSample.raw_lat, prevSample.raw_lng,
    currentSample.raw_lat, currentSample.raw_lng
  );
  
  const timeDiff = (new Date(currentSample.timestamp) - new Date(prevSample.timestamp)) / 1000;
  
  if (timeDiff <= 0) return false;
  
  const speed = distance / timeDiff;
  
  return speed > speedThreshold;
}

function checkHidingSpotHit(playerLat, playerLng, spot, scanRadius = 5) {
  const distance = calculateDistance(playerLat, playerLng, spot.lat, spot.lng);
  const effectiveRadius = Math.max(spot.radius, scanRadius);
  
  return {
    isHit: distance <= effectiveRadius,
    distance: distance,
    effectiveRadius: effectiveRadius
  };
}

function checkContinuousApproach(samples, spot, requiredSamples = 3) {
  if (samples.length < requiredSamples) return null;
  
  const recentSamples = samples.slice(-requiredSamples);
  
  let consistentlyApproaching = true;
  let previousDistance = null;
  
  for (const sample of recentSamples) {
    const distance = calculateDistance(sample.noisy_lat, sample.noisy_lng, spot.lat, spot.lng);
    
    if (previousDistance !== null && distance >= previousDistance) {
      consistentlyApproaching = false;
      break;
    }
    previousDistance = distance;
  }
  
  if (consistentlyApproaching) {
    return {
      isHit: true,
      lastSample: recentSamples[recentSamples.length - 1],
      reason: '连续靠近判定'
    };
  }
  
  return null;
}

function isInInterferenceZone(lat, lng, zones) {
  for (const zone of zones) {
    const distance = calculateDistance(lat, lng, zone.lat, zone.lng);
    if (distance <= zone.radius) {
      return zone;
    }
  }
  return null;
}

module.exports = {
  calculateDistance,
  calculateBearing,
  getDirectionFromBearing,
  generateDriftNoise,
  calculateDriftLevel,
  detectSuspiciousJump,
  checkHidingSpotHit,
  checkContinuousApproach,
  isInInterferenceZone
};
