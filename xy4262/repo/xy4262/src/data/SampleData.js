export class SampleData {
  static getDronesData() {
    const drones = [];
    const droneCount = 8;
    
    for (let i = 0; i < droneCount; i++) {
      const drone = {
        id: `drone_${i}`,
        name: `无人机 ${i + 1}`,
        batteryId: `battery_${i % 4}`,
        waypoints: this.generateWaypoints(i, droneCount),
        color: this.getColor(i)
      };
      drones.push(drone);
    }
    
    return drones;
  }

  static generateWaypoints(droneIndex, totalDrones) {
    const waypoints = [];
    const totalTime = 120;
    const segments = 6;
    
    const startAngle = (droneIndex / totalDrones) * Math.PI * 2;
    const startRadius = 50;
    const startX = Math.cos(startAngle) * startRadius;
    const startY = Math.sin(startAngle) * startRadius;
    
    waypoints.push({
      time: 0,
      x: startX,
      y: startY,
      z: 5,
      speed: 2
    });
    
    for (let seg = 1; seg <= segments; seg++) {
      const progress = seg / segments;
      const time = progress * totalTime;
      
      const pattern = seg % 3;
      let x, y, z;
      
      if (pattern === 0) {
        const angle = startAngle + progress * Math.PI * 4;
        const radius = 30 + Math.sin(progress * Math.PI * 2) * 15;
        x = Math.cos(angle) * radius;
        y = Math.sin(angle) * radius;
        z = 15 + Math.sin(angle * 2) * 8;
        
        if (droneIndex === 0 || droneIndex === 1) {
          x = Math.cos(angle) * (radius * 0.3);
          y = Math.sin(angle) * (radius * 0.3);
        }
      } else if (pattern === 1) {
        const targetAngle = startAngle + Math.PI;
        const radius = 40;
        const moveProgress = Math.min(1, (progress - 0.33) * 3);
        const currentAngle = startAngle + (targetAngle - startAngle) * moveProgress;
        
        x = Math.cos(currentAngle) * radius;
        y = Math.sin(currentAngle) * radius;
        z = 20 + Math.sin(moveProgress * Math.PI) * 10;
        
        if (droneIndex === 2 && moveProgress > 0.5) {
          x = Math.cos(currentAngle) * (radius * 0.8);
          y = Math.sin(currentAngle) * (radius * 0.8);
        }
      } else {
        const rows = 2;
        const cols = 4;
        const row = Math.floor(droneIndex / cols);
        const col = droneIndex % cols;
        
        const spacing = 15;
        x = (col - cols / 2 + 0.5) * spacing;
        y = (row - rows / 2 + 0.5) * spacing;
        z = 25;
        
        if (droneIndex === 4) {
          z = 5;
        }
        
        if (droneIndex === 5) {
          x = -100;
          y = -100;
          z = 5;
        }
      }
      
      waypoints.push({
        time: time,
        x: x,
        y: y,
        z: z,
        speed: 3
      });
    }
    
    waypoints.push({
      time: totalTime + 10,
      x: startX,
      y: startY,
      z: 5,
      speed: 2
    });
    
    return waypoints;
  }

  static getColor(index) {
    const colors = [
      '#ff6b6b',
      '#4ecdc4',
      '#45b7d1',
      '#96ceb4',
      '#ffeaa7',
      '#dfe6e9',
      '#fd79a8',
      '#a29bfe'
    ];
    return colors[index % colors.length];
  }

  static getNoFlyZones() {
    return [
      {
        id: 'nofly_001',
        name: '中央建筑物禁飞区',
        type: 'restricted',
        shape: 'circle',
        center: { x: 0, y: 0 },
        radius: 20,
        minAltitude: 0,
        maxAltitude: 100,
        startTime: 0,
        endTime: null
      },
      {
        id: 'nofly_002',
        name: '机场跑道区域',
        type: 'critical',
        shape: 'polygon',
        coordinates: [
          { x: 60, y: 60 },
          { x: 120, y: 60 },
          { x: 120, y: -60 },
          { x: 60, y: -60 }
        ],
        minAltitude: 0,
        maxAltitude: 200,
        startTime: 0,
        endTime: null
      },
      {
        id: 'nofly_003',
        name: '临时活动区域',
        type: 'temporary',
        shape: 'circle',
        center: { x: -50, y: 30 },
        radius: 15,
        minAltitude: 10,
        maxAltitude: 50,
        startTime: 30,
        endTime: 90
      }
    ];
  }

  static getBeatsData() {
    const beats = [];
    const totalBeats = 48;
    const bpm = 120;
    const beatInterval = 60 / bpm;
    
    for (let i = 0; i < totalBeats; i++) {
      const measure = Math.floor(i / 4) + 1;
      const beatInMeasure = (i % 4) + 1;
      
      beats.push({
        time: i * beatInterval,
        type: beatInMeasure === 1 ? 'strong' : 'weak',
        measure: measure,
        beat: beatInMeasure,
        intensity: beatInMeasure === 1 ? 1.0 : 0.6
      });
    }
    
    return beats;
  }

  static getBatteriesData() {
    return [
      {
        id: 'battery_0',
        capacity: 95,
        drainRate: 0.6,
        voltage: 3.7,
        cycleCount: 15,
        health: 'good'
      },
      {
        id: 'battery_1',
        capacity: 88,
        drainRate: 0.7,
        voltage: 3.6,
        cycleCount: 35,
        health: 'fair'
      },
      {
        id: 'battery_2',
        capacity: 75,
        drainRate: 0.9,
        voltage: 3.5,
        cycleCount: 60,
        health: 'poor'
      },
      {
        id: 'battery_3',
        capacity: 98,
        drainRate: 0.5,
        voltage: 3.8,
        cycleCount: 5,
        health: 'excellent'
      }
    ];
  }

  static exportDronesJSON() {
    return JSON.stringify({
      version: '1.0',
      generatedAt: new Date().toISOString(),
      drones: this.getDronesData()
    }, null, 2);
  }

  static exportNoFlyGeoJSON() {
    const zones = this.getNoFlyZones();
    
    const features = zones.map(zone => {
      if (zone.shape === 'circle') {
        return {
          type: 'Feature',
          properties: {
            id: zone.id,
            name: zone.name,
            type: zone.type,
            radius: zone.radius,
            minAltitude: zone.minAltitude,
            maxAltitude: zone.maxAltitude,
            startTime: zone.startTime,
            endTime: zone.endTime
          },
          geometry: {
            type: 'Point',
            coordinates: [zone.center.x, zone.center.y]
          }
        };
      } else {
        return {
          type: 'Feature',
          properties: {
            id: zone.id,
            name: zone.name,
            type: zone.type,
            minAltitude: zone.minAltitude,
            maxAltitude: zone.maxAltitude,
            startTime: zone.startTime,
            endTime: zone.endTime
          },
          geometry: {
            type: 'Polygon',
            coordinates: [
              zone.coordinates.map(c => [c.x, c.y])
            ]
          }
        };
      }
    });
    
    return JSON.stringify({
      type: 'FeatureCollection',
      features: features
    }, null, 2);
  }

  static exportBeatsCSV() {
    const beats = this.getBeatsData();
    let csv = 'time,type,measure,beat,intensity\n';
    
    beats.forEach(beat => {
      csv += `${beat.time.toFixed(3)},${beat.type},${beat.measure},${beat.beat},${beat.intensity}\n`;
    });
    
    return csv;
  }

  static exportBatteriesCSV() {
    const batteries = this.getBatteriesData();
    let csv = 'id,capacity,drain_rate,voltage,cycle_count,health\n';
    
    batteries.forEach(bat => {
      csv += `${bat.id},${bat.capacity},${bat.drainRate},${bat.voltage},${bat.cycleCount},${bat.health}\n`;
    });
    
    return csv;
  }
}
