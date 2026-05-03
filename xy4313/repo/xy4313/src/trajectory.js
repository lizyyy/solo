export class TrajectoryCalculator {
  constructor() {
    this.trajectory = null;
    this.interpolatedPoints = null;
  }

  loadTrajectory(trajectoryData) {
    this.trajectory = trajectoryData;
    this.calculateTotalDistance();
    this.calculateVelocities();
  }

  calculateTotalDistance() {
    if (!this.trajectory || !this.trajectory.points) return 0;

    let totalDistance = 0;
    const points = this.trajectory.points;

    for (let i = 1; i < points.length; i++) {
      const dx = points[i].position.x - points[i-1].position.x;
      const dz = points[i].position.z - points[i-1].position.z;
      totalDistance += Math.sqrt(dx * dx + dz * dz);
    }

    this.trajectory.totalDistance = totalDistance;
    return totalDistance;
  }

  calculateVelocities() {
    if (!this.trajectory || !this.trajectory.points) return;

    const points = this.trajectory.points;

    for (let i = 0; i < points.length; i++) {
      if (i < points.length - 1) {
        const dx = points[i+1].position.x - points[i].position.x;
        const dz = points[i+1].position.z - points[i].position.z;
        const dt = (points[i+1].timestamp - points[i].timestamp) / 1000;
        
        if (dt > 0) {
          const distance = Math.sqrt(dx * dx + dz * dz);
          const speed = distance / dt;
          
          if (points[i].speed === 0) {
            points[i].calculatedSpeed = speed;
          }
          
          points[i].directionAngle = Math.atan2(dz, dx) * (180 / Math.PI);
        }
      }

      if (i > 0) {
        points[i].acceleration = this.calculateAcceleration(
          points[i-1],
          points[i]
        );
      }
    }
  }

  calculateAcceleration(prevPoint, currPoint) {
    const dt = (currPoint.timestamp - prevPoint.timestamp) / 1000;
    if (dt <= 0) return 0;

    const prevSpeed = prevPoint.speed ?? prevPoint.calculatedSpeed ?? 0;
    const currSpeed = currPoint.speed ?? currPoint.calculatedSpeed ?? 0;
    
    return (currSpeed - prevSpeed) / dt;
  }

  interpolateAtTimestamp(targetTimestamp) {
    if (!this.trajectory || !this.trajectory.points) return null;

    const points = this.trajectory.points;
    
    if (points.length === 0) return null;
    if (targetTimestamp <= points[0].timestamp) return this.clonePoint(points[0]);
    if (targetTimestamp >= points[points.length - 1].timestamp) {
      return this.clonePoint(points[points.length - 1]);
    }

    let left = 0;
    let right = points.length - 1;
    while (left < right - 1) {
      const mid = Math.floor((left + right) / 2);
      if (points[mid].timestamp <= targetTimestamp) {
        left = mid;
      } else {
        right = mid;
      }
    }

    const p1 = points[left];
    const p2 = points[right];
    
    const t1 = p1.timestamp;
    const t2 = p2.timestamp;
    const alpha = (targetTimestamp - t1) / (t2 - t1);

    return this.interpolatePoints(p1, p2, alpha, targetTimestamp);
  }

  interpolatePoints(p1, p2, alpha, targetTimestamp) {
    return {
      index: p1.index + (p2.index - p1.index) * alpha,
      timestamp: targetTimestamp,
      forkliftId: p1.forkliftId,
      position: {
        x: p1.position.x + (p2.position.x - p1.position.x) * alpha,
        y: p1.position.y + (p2.position.y - p1.position.y) * alpha,
        z: p1.position.z + (p2.position.z - p1.position.z) * alpha
      },
      speed: p1.speed + (p2.speed - p1.speed) * alpha,
      speedLimit: p1.speedLimit,
      direction: p1.direction + (p2.direction - p1.direction) * alpha,
      isReversing: alpha > 0.5 ? p2.isReversing : p1.isReversing,
      gear: alpha > 0.5 ? p2.gear : p1.gear,
      steeringAngle: p1.steeringAngle + (p2.steeringAngle - p1.steeringAngle) * alpha,
      loadWeight: p1.loadWeight + (p2.loadWeight - p1.loadWeight) * alpha
    };
  }

  clonePoint(point) {
    return {
      ...point,
      position: { ...point.position }
    };
  }

  getPointsInTimeRange(startTimestamp, endTimestamp) {
    if (!this.trajectory || !this.trajectory.points) return [];

    const points = this.trajectory.points;
    return points.filter(p => 
      p.timestamp >= startTimestamp && p.timestamp <= endTimestamp
    );
  }

  getTurningPoints(angleThreshold = 30) {
    if (!this.trajectory || !this.trajectory.points) return [];

    const points = this.trajectory.points;
    const turningPoints = [];

    for (let i = 1; i < points.length - 1; i++) {
      const prevAngle = points[i].directionAngle ?? points[i].direction ?? 0;
      const nextAngle = points[i+1].directionAngle ?? points[i+1].direction ?? 0;
      
      let angleDiff = Math.abs(nextAngle - prevAngle);
      if (angleDiff > 180) angleDiff = 360 - angleDiff;

      if (angleDiff >= angleThreshold) {
        turningPoints.push({
          point: points[i],
          angleChange: angleDiff,
          isSharpTurn: angleDiff > 60
        });
      }
    }

    return turningPoints;
  }

  getReversingSegments() {
    if (!this.trajectory || !this.trajectory.points) return [];

    const points = this.trajectory.points;
    const segments = [];
    let currentSegment = null;

    for (let i = 0; i < points.length; i++) {
      const isReversing = points[i].isReversing || 
        (points[i].gear === 'reverse') ||
        (points[i].speed < 0);

      if (isReversing) {
        if (!currentSegment) {
          currentSegment = {
            startIndex: i,
            startTime: points[i].timestamp,
            points: []
          };
        }
        currentSegment.points.push(points[i]);
      } else {
        if (currentSegment) {
          currentSegment.endIndex = i - 1;
          currentSegment.endTime = points[i-1].timestamp;
          currentSegment.maxSpeed = Math.max(...currentSegment.points.map(p => 
            Math.abs(p.speed ?? p.calculatedSpeed ?? 0)
          ));
          segments.push(currentSegment);
          currentSegment = null;
        }
      }
    }

    if (currentSegment) {
      const lastIndex = points.length - 1;
      currentSegment.endIndex = lastIndex;
      currentSegment.endTime = points[lastIndex].timestamp;
      currentSegment.maxSpeed = Math.max(...currentSegment.points.map(p => 
        Math.abs(p.speed ?? p.calculatedSpeed ?? 0)
      ));
      segments.push(currentSegment);
    }

    return segments;
  }

  getBlindSpotProximity(shelves, position, threshold = 5) {
    if (!shelves || !shelves.shelves) return [];

    const proximateBlindSpots = [];

    shelves.shelves.forEach(shelf => {
      if (shelf.isBlindSpot && shelf.blindSpotZone) {
        const dx = position.x - shelf.position.x;
        const dz = position.z - shelf.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance <= threshold) {
          proximateBlindSpots.push({
            shelf: shelf,
            distance: distance,
            angle: Math.atan2(dz, dx) * (180 / Math.PI)
          });
        }
      }
    });

    return proximateBlindSpots;
  }

  getTimeRange() {
    if (!this.trajectory || !this.trajectory.points) {
      return { start: 0, end: 0, duration: 0 };
    }

    const points = this.trajectory.points;
    const start = points[0].timestamp;
    const end = points[points.length - 1].timestamp;

    return {
      start: start,
      end: end,
      duration: end - start
    };
  }

  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}

export default TrajectoryCalculator;
