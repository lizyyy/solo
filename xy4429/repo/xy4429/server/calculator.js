const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateClimbSegmentTime = (segment, baseSpeed, fitnessLevel = 'normal') => {
  const { distance, elevationGain, averageGrade } = segment;
  
  let speedMultiplier = 1;
  switch(fitnessLevel) {
    case 'high': speedMultiplier = 1.2; break;
    case 'low': speedMultiplier = 0.8; break;
    default: speedMultiplier = 1;
  }
  
  const effectiveSpeed = baseSpeed * speedMultiplier;
  
  if (elevationGain <= 0 || averageGrade <= 0) {
    return distance / effectiveSpeed;
  }
  
  let gradeSlowdown = 1;
  if (averageGrade > 10) {
    gradeSlowdown = 0.4;
  } else if (averageGrade > 7) {
    gradeSlowdown = 0.55;
  } else if (averageGrade > 5) {
    gradeSlowdown = 0.7;
  } else if (averageGrade > 3) {
    gradeSlowdown = 0.85;
  }
  
  const climbSpeed = effectiveSpeed * gradeSlowdown;
  return distance / climbSpeed;
};

const calculateRideMetrics = (gpxData) => {
  if (!gpxData || !gpxData.trk || gpxData.trk.length === 0) {
    throw new Error('无效的GPX数据');
  }
  
  const track = gpxData.trk[0];
  const segments = track.trkseg || [];
  
  if (segments.length === 0 || !segments[0].trkpt) {
    throw new Error('GPX文件中没有轨迹点数据');
  }
  
  const points = segments[0].trkpt;
  
  if (points.length < 2) {
    throw new Error('GPX文件中的轨迹点不足');
  }
  
  let totalDistance = 0;
  let totalElevationGain = 0;
  let totalElevationLoss = 0;
  let maxElevation = -Infinity;
  let minElevation = Infinity;
  
  const routeSegments = [];
  const SEGMENT_MIN_DISTANCE = 1.0;
  
  let segmentStartIdx = 0;
  let segmentDistance = 0;
  let segmentElevationGain = 0;
  let segmentElevationLoss = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currPoint = points[i];
    
    const dist = haversineDistance(
      parseFloat(prevPoint.$.lat),
      parseFloat(prevPoint.$.lon),
      parseFloat(currPoint.$.lat),
      parseFloat(currPoint.$.lon)
    );
    
    const prevElev = prevPoint.ele ? parseFloat(prevPoint.ele[0]) : 0;
    const currElev = currPoint.ele ? parseFloat(currPoint.ele[0]) : 0;
    const elevDiff = currElev - prevElev;
    
    totalDistance += dist;
    segmentDistance += dist;
    
    if (elevDiff > 0) {
      totalElevationGain += elevDiff;
      segmentElevationGain += elevDiff;
    } else if (elevDiff < 0) {
      totalElevationLoss += Math.abs(elevDiff);
      segmentElevationLoss += Math.abs(elevDiff);
    }
    
    if (currElev > maxElevation) maxElevation = currElev;
    if (currElev < minElevation) minElevation = currElev;
    
    if (segmentDistance >= SEGMENT_MIN_DISTANCE || i === points.length - 1) {
      if (segmentDistance > 0) {
        const avgGrade = segmentDistance > 0 ? (segmentElevationGain / (segmentDistance * 1000)) * 100 : 0;
        
        routeSegments.push({
          name: `路段${routeSegments.length + 1}`,
          startPoint: {
            lat: parseFloat(points[segmentStartIdx].$.lat),
            lon: parseFloat(points[segmentStartIdx].$.lon),
            elev: points[segmentStartIdx].ele ? parseFloat(points[segmentStartIdx].ele[0]) : 0
          },
          endPoint: {
            lat: parseFloat(points[i].$.lat),
            lon: parseFloat(points[i].$.lon),
            elev: points[i].ele ? parseFloat(points[i].ele[0]) : 0
          },
          distance: segmentDistance,
          elevationGain: segmentElevationGain,
          elevationLoss: segmentElevationLoss,
          averageGrade: avgGrade,
          duration: 0
        });
      }
      
      segmentStartIdx = i;
      segmentDistance = 0;
      segmentElevationGain = 0;
      segmentElevationLoss = 0;
    }
  }
  
  const baseSpeed = 20;
  routeSegments.forEach(segment => {
    segment.duration = calculateClimbSegmentTime(segment, baseSpeed);
  });
  
  const totalDuration = routeSegments.reduce((sum, seg) => sum + seg.duration, 0);
  
  return {
    totalDistance,
    totalElevationGain,
    totalElevationLoss,
    maxElevation,
    minElevation,
    totalDuration,
    segments: routeSegments,
    rawPoints: points
  };
};

const calculateRiskLevel = (rider, segment) => {
  let riskScore = 0;
  const notes = [];
  
  if (segment.averageGrade > 7) {
    riskScore += 5;
    notes.push('陡坡路段');
  } else if (segment.averageGrade > 5) {
    riskScore += 3;
    notes.push('中等坡度');
  }
  
  if (segment.elevationGain > 200) {
    riskScore += 4;
    notes.push('大量爬升');
  } else if (segment.elevationGain > 100) {
    riskScore += 2;
  }
  
  if (segment.duration > 1.5) {
    riskScore += 3;
    notes.push('长距离路段');
  } else if (segment.duration > 0.8) {
    riskScore += 1;
  }
  
  if (rider.fitnessLevel === 'low') {
    riskScore += 3;
    notes.push('体能较弱');
  } else if (rider.fitnessLevel === 'high') {
    riskScore -= 2;
  }
  
  if (rider.lightOutput < 800) {
    riskScore += 4;
    notes.push('灯具亮度不足');
  } else if (rider.lightOutput < 1200) {
    riskScore += 2;
  }
  
  if (rider.batteryRemaining < 30) {
    riskScore += 5;
    notes.push('电池电量低');
  } else if (rider.batteryRemaining < 50) {
    riskScore += 2;
  }
  
  riskScore = Math.max(0, riskScore);
  
  let riskLevel;
  if (riskScore >= 12) {
    riskLevel = 'red';
  } else if (riskScore >= 6) {
    riskLevel = 'yellow';
  } else {
    riskLevel = 'green';
  }
  
  return {
    score: riskScore,
    level: riskLevel,
    notes
  };
};

const calculateBatteryMargin = (rider, segment, elapsedHours = 0) => {
  const { lightOutput, batteryCapacity, batteryRemaining } = rider;
  
  const powerConsumptionPerHour = lightOutput * 0.005;
  
  const totalBatteryHours = batteryCapacity / powerConsumptionPerHour;
  
  const usedHours = elapsedHours + segment.duration;
  
  const remainingBatteryHours = totalBatteryHours * (batteryRemaining / 100) - usedHours;
  
  const margin = remainingBatteryHours / totalBatteryHours;
  
  const estimatedRemaining = Math.max(0, (batteryRemaining / 100) - (usedHours / totalBatteryHours));
  
  return {
    margin: Math.max(-1, margin),
    remaining: Math.max(0, estimatedRemaining),
    totalBatteryHours,
    usedHours,
    remainingHours: Math.max(0, remainingBatteryHours)
  };
};

module.exports = {
  calculateRideMetrics,
  calculateClimbSegmentTime,
  calculateRiskLevel,
  calculateBatteryMargin,
  haversineDistance
};
