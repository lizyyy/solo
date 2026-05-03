export class SampleData {
  static generateForkliftCSV() {
    const rows = [
      'id,device_id,timestamp,x,y,z,heading,speed'
    ];
    
    const startTime = 0;
    const frameInterval = 0.1;
    const totalFrames = 150;
    
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = startTime + i * frameInterval;
      
      let x, z, heading;
      
      if (i < 50) {
        x = 5 + i * 0.3;
        z = 10;
        heading = 0;
      } else if (i < 100) {
        x = 20;
        z = 10 + (i - 50) * 0.3;
        heading = Math.PI / 2;
      } else {
        x = 20 + (i - 100) * 0.4;
        z = 25;
        heading = 0;
      }
      
      const speed = (i >= 40 && i <= 80) ? 3.5 : 2.0;
      
      rows.push(`${i},forklift_1,${timestamp.toFixed(2)},${x.toFixed(3)},0,${z.toFixed(3)},${heading.toFixed(3)},${speed.toFixed(2)}`);
    }
    
    return rows.join('\n');
  }

  static generatePedestrianJSON() {
    const data = [];
    const startTime = 0;
    const frameInterval = 0.1;
    const totalFrames = 150;
    
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = startTime + i * frameInterval;
      
      let x, z;
      
      if (i < 40) {
        x = 18;
        z = 5 + i * 0.25;
      } else if (i < 90) {
        x = 18 + (i - 40) * 0.35;
        z = 15;
      } else {
        x = 35.5 + (i - 90) * 0.2;
        z = 15 + (i - 90) * 0.15;
      }
      
      data.push({
        id: i,
        device_id: 'pedestrian_1',
        timestamp: timestamp,
        x: x,
        y: 0,
        z: z
      });
    }
    
    return JSON.stringify(data, null, 2);
  }

  static generateWarehouseJSON() {
    const warehouse = {
      name: '示例仓库区域',
      dimensions: {
        width: 50,
        depth: 30,
        height: 6
      },
      racks: [
        {
          id: 'rack_1',
          name: '货架 A区',
          position: { x: 2, y: 0, z: 2 },
          dimensions: { width: 8, depth: 1, height: 3 },
          levels: 5,
          color: '#4a6fa5'
        },
        {
          id: 'rack_2',
          name: '货架 B区',
          position: { x: 2, y: 0, z: 14 },
          dimensions: { width: 8, depth: 1, height: 3 },
          levels: 5,
          color: '#4a6fa5'
        },
        {
          id: 'rack_3',
          name: '货架 C区',
          position: { x: 2, y: 0, z: 26 },
          dimensions: { width: 8, depth: 1, height: 3 },
          levels: 5,
          color: '#4a6fa5'
        },
        {
          id: 'rack_4',
          name: '货架 D区',
          position: { x: 35, y: 0, z: 2 },
          dimensions: { width: 12, depth: 1, height: 3 },
          levels: 5,
          color: '#6b4a8e'
        },
        {
          id: 'rack_5',
          name: '货架 E区',
          position: { x: 35, y: 0, z: 14 },
          dimensions: { width: 12, depth: 1, height: 3 },
          levels: 5,
          color: '#6b4a8e'
        },
        {
          id: 'rack_6',
          name: '货架 F区',
          position: { x: 35, y: 0, z: 26 },
          dimensions: { width: 12, depth: 1, height: 3 },
          levels: 5,
          color: '#6b4a8e'
        }
      ],
      obstacles: [
        {
          id: 'pillar_1',
          type: 'pillar',
          position: { x: 20, y: 0, z: 10 },
          dimensions: { width: 0.6, depth: 0.6, height: 5 }
        },
        {
          id: 'pillar_2',
          type: 'pillar',
          position: { x: 30, y: 0, z: 20 },
          dimensions: { width: 0.6, depth: 0.6, height: 5 }
        }
      ],
      safeZones: [
        {
          id: 'zone_1',
          name: '人行通道',
          type: 'walkway',
          polygon: [
            { x: 12, z: 13 },
            { x: 28, z: 13 },
            { x: 28, z: 17 },
            { x: 12, z: 17 }
          ]
        }
      ]
    };
    
    return JSON.stringify(warehouse, null, 2);
  }

  static getAllSampleData() {
    return {
      forkliftCSV: this.generateForkliftCSV(),
      pedestrianJSON: this.generatePedestrianJSON(),
      warehouseJSON: this.generateWarehouseJSON()
    };
  }

  static generateNearMissData() {
    const forkliftRows = ['id,device_id,timestamp,x,y,z,heading,speed'];
    const pedestrianPoints = [];
    
    const startTime = 0;
    const frameInterval = 0.08;
    const totalFrames = 120;
    
    for (let i = 0; i < totalFrames; i++) {
      const timestamp = startTime + i * frameInterval;
      
      let forkX, forkZ, forkHeading;
      let pedX, pedZ;
      
      if (i < 60) {
        forkX = 15 + i * 0.4;
        forkZ = 8;
        forkHeading = 0;
        
        pedX = 25;
        pedZ = 5 + i * 0.2;
      } else if (i < 90) {
        forkX = 39 + (i - 60) * 0.3;
        forkZ = 8 + (i - 60) * 0.35;
        forkHeading = Math.PI / 4;
        
        pedX = 25 + (i - 60) * 0.45;
        pedZ = 17;
      } else {
        forkX = 48;
        forkZ = 18.5 + (i - 90) * 0.25;
        forkHeading = Math.PI / 2;
        
        pedX = 38.5 + (i - 90) * 0.35;
        pedZ = 17 + (i - 90) * 0.2;
      }
      
      forkliftRows.push(
        `${i},forklift_1,${timestamp.toFixed(2)},${forkX.toFixed(3)},0,${forkZ.toFixed(3)},${forkHeading.toFixed(3)},${i >= 50 ? 4.5 : 3.0}`
      );
      
      pedestrianPoints.push({
        id: i,
        device_id: 'pedestrian_1',
        timestamp: timestamp,
        x: pedX,
        y: 0,
        z: pedZ
      });
    }
    
    return {
      forkliftCSV: forkliftRows.join('\n'),
      pedestrianJSON: JSON.stringify(pedestrianPoints, null, 2),
      warehouseJSON: this.generateWarehouseJSON()
    };
  }

  static getExpectedRiskPoints() {
    return [
      {
        id: 'risk_0',
        type: 'danger',
        level: 'high',
        startTime: 5.5,
        endTime: 7.2,
        duration: 1.7,
        minDistance: 1.2,
        forkliftPositions: {
          start: { x: 42, z: 12 },
          end: { x: 48, z: 18 }
        },
        pedestrianPositions: {
          start: { x: 38, z: 17 },
          end: { x: 45, z: 20 }
        }
      },
      {
        id: 'risk_1',
        type: 'warning',
        level: 'medium',
        startTime: 4.8,
        endTime: 5.5,
        duration: 0.7,
        minDistance: 2.5,
        forkliftPositions: {
          start: { x: 38, z: 10 },
          end: { x: 42, z: 12 }
        },
        pedestrianPositions: {
          start: { x: 34, z: 17 },
          end: { x: 38, z: 17 }
        }
      }
    ];
  }
}

export default SampleData;
