import * as THREE from 'three';

export const LoadStatus = {
  SAFE: 'safe',
  WARNING: 'warning',
  DANGER: 'danger'
};

export class LoadCalculator {
  constructor(stage) {
    this.stage = stage;
    this.loadData = {
      hoistPoints: {},
      bars: {},
      totalLoad: 0
    };
  }
  
  calculateAll() {
    this.loadData = {
      hoistPoints: {},
      bars: {},
      totalLoad: 0
    };
    
    for (const hoistPoint of this.stage.hoistPoints) {
      this.loadData.hoistPoints[hoistPoint.userData.id] = {
        load: 0,
        maxLoad: hoistPoint.userData.maxLoad,
        status: LoadStatus.SAFE,
        devices: [],
        bars: []
      };
    }
    
    for (const bar of this.stage.bars) {
      this.calculateBarLoad(bar);
    }
    
    for (const device of this.stage.devices) {
      this.calculateDeviceLoad(device);
    }
    
    this.updateStatus();
    
    return this.loadData;
  }
  
  calculateBarLoad(bar) {
    const barWeight = bar.getWeight();
    const barId = bar.userData.id;
    
    this.loadData.bars[barId] = {
      totalWeight: barWeight,
      segmentLoads: [],
      attachedDevices: []
    };
    
    if (bar.userData.supportHoistPoints.length >= 2) {
      const supportPoints = [];
      
      for (const hoistId of bar.userData.supportHoistPoints) {
        const hoistPoint = this.stage.getHoistPointById(hoistId);
        if (hoistPoint) {
          supportPoints.push({
            id: hoistId,
            point: new THREE.Vector2(
              hoistPoint.userData.x,
              hoistPoint.userData.z
            )
          });
        }
      }
      
      if (supportPoints.length >= 2) {
        const barStart = new THREE.Vector2(
          bar.userData.startX,
          bar.userData.startZ
        );
        const barEnd = new THREE.Vector2(
          bar.userData.endX,
          bar.userData.endZ
        );
        
        const barVector = barEnd.clone().sub(barStart);
        const barLength = barVector.length();
        
        const projectedSupportPoints = supportPoints.map(sp => {
          const toPoint = sp.point.clone().sub(barStart);
          const projection = toPoint.dot(barVector) / barLength;
          return {
            id: sp.id,
            position: projection,
            weight: 0
          };
        }).sort((a, b) => a.position - b.position);
        
        const uniformLoad = barWeight / barLength;
        
        for (let i = 0; i < projectedSupportPoints.length - 1; i++) {
          const left = projectedSupportPoints[i];
          const right = projectedSupportPoints[i + 1];
          const segmentLength = right.position - left.position;
          const segmentLoad = uniformLoad * segmentLength;
          
          left.weight += segmentLoad / 2;
          right.weight += segmentLoad / 2;
          
          this.loadData.bars[barId].segmentLoads.push({
            start: left.position,
            end: right.position,
            load: segmentLoad,
            startHoistId: left.id,
            endHoistId: right.id
          });
        }
        
        for (const sp of projectedSupportPoints) {
          if (this.loadData.hoistPoints[sp.id]) {
            this.loadData.hoistPoints[sp.id].load += sp.weight;
            this.loadData.hoistPoints[sp.id].bars.push(barId);
          }
        }
      }
    }
  }
  
  calculateDeviceLoad(device) {
    const deviceWeight = device.userData.weight;
    this.loadData.totalLoad += deviceWeight;
    
    if (device.userData.attachedTo) {
      const attachedType = device.userData.attachType;
      
      if (attachedType === 'hoistPoint') {
        const hoistId = device.userData.attachedTo;
        if (this.loadData.hoistPoints[hoistId]) {
          this.loadData.hoistPoints[hoistId].load += deviceWeight;
          this.loadData.hoistPoints[hoistId].devices.push({
            id: device.userData.id,
            weight: deviceWeight
          });
        }
      } else if (attachedType === 'bar') {
        const barId = device.userData.attachedTo;
        const bar = this.stage.getBarById(barId);
        
        if (bar && this.loadData.bars[barId]) {
          this.loadData.bars[barId].attachedDevices.push({
            id: device.userData.id,
            weight: deviceWeight,
            position: new THREE.Vector2(
              device.userData.position.x,
              device.userData.position.z
            )
          });
          
          this.distributeDeviceLoadOnBar(device, bar, deviceWeight);
        }
      }
    }
  }
  
  distributeDeviceLoadOnBar(device, bar, weight) {
    if (bar.userData.supportHoistPoints.length < 2) return;
    
    const supportPoints = [];
    for (const hoistId of bar.userData.supportHoistPoints) {
      const hoistPoint = this.stage.getHoistPointById(hoistId);
      if (hoistPoint) {
        supportPoints.push({
          id: hoistId,
          point: new THREE.Vector2(
            hoistPoint.userData.x,
            hoistPoint.userData.z
          )
        });
      }
    }
    
    if (supportPoints.length < 2) return;
    
    const barStart = new THREE.Vector2(
      bar.userData.startX,
      bar.userData.startZ
    );
    const barEnd = new THREE.Vector2(
      bar.userData.endX,
      bar.userData.endZ
    );
    
    const barVector = barEnd.clone().sub(barStart);
    const barLength = barVector.length();
    
    const devicePoint = new THREE.Vector2(
      device.userData.position.x,
      device.userData.position.z
    );
    const toDevice = devicePoint.clone().sub(barStart);
    const deviceProjection = toDevice.dot(barVector) / barLength;
    
    const projectedSupportPoints = supportPoints.map(sp => {
      const toPoint = sp.point.clone().sub(barStart);
      const projection = toPoint.dot(barVector) / barLength;
      return {
        id: sp.id,
        position: projection
      };
    }).sort((a, b) => a.position - b.position);
    
    let leftSupport = null;
    let rightSupport = null;
    
    for (let i = 0; i < projectedSupportPoints.length - 1; i++) {
      if (deviceProjection >= projectedSupportPoints[i].position &&
          deviceProjection <= projectedSupportPoints[i + 1].position) {
        leftSupport = projectedSupportPoints[i];
        rightSupport = projectedSupportPoints[i + 1];
        break;
      }
    }
    
    if (!leftSupport || !rightSupport) {
      if (deviceProjection < projectedSupportPoints[0].position) {
        leftSupport = projectedSupportPoints[0];
        rightSupport = projectedSupportPoints[1];
      } else {
        leftSupport = projectedSupportPoints[projectedSupportPoints.length - 2];
        rightSupport = projectedSupportPoints[projectedSupportPoints.length - 1];
      }
    }
    
    const segmentLength = rightSupport.position - leftSupport.position;
    const deviceDistanceFromLeft = deviceProjection - leftSupport.position;
    const deviceDistanceFromRight = rightSupport.position - deviceProjection;
    
    const leftWeight = weight * (deviceDistanceFromRight / segmentLength);
    const rightWeight = weight * (deviceDistanceFromLeft / segmentLength);
    
    if (this.loadData.hoistPoints[leftSupport.id]) {
      this.loadData.hoistPoints[leftSupport.id].load += leftWeight;
      this.loadData.hoistPoints[leftSupport.id].devices.push({
        id: device.userData.id,
        weight: leftWeight
      });
    }
    
    if (this.loadData.hoistPoints[rightSupport.id]) {
      this.loadData.hoistPoints[rightSupport.id].load += rightWeight;
      this.loadData.hoistPoints[rightSupport.id].devices.push({
        id: device.userData.id,
        weight: rightWeight
      });
    }
  }
  
  updateStatus() {
    for (const hoistId in this.loadData.hoistPoints) {
      const hoistData = this.loadData.hoistPoints[hoistId];
      const ratio = hoistData.load / hoistData.maxLoad;
      
      if (ratio > 1) {
        hoistData.status = LoadStatus.DANGER;
      } else if (ratio > 0.85) {
        hoistData.status = LoadStatus.WARNING;
      } else {
        hoistData.status = LoadStatus.SAFE;
      }
      
      const hoistPoint = this.stage.getHoistPointById(hoistId);
      if (hoistPoint) {
        hoistPoint.updateLoad(hoistData.load);
      }
    }
  }
  
  getHoistPointLoad(hoistId) {
    return this.loadData.hoistPoints[hoistId];
  }
  
  getBarLoad(barId) {
    return this.loadData.bars[barId];
  }
  
  getTotalLoad() {
    return this.loadData.totalLoad;
  }
  
  checkLoadBalance() {
    const issues = [];
    
    const hoistPoints = Object.values(this.loadData.hoistPoints);
    const loadedHoists = hoistPoints.filter(hp => hp.load > 0);
    
    if (loadedHoists.length >= 2) {
      const totalLoad = loadedHoists.reduce((sum, hp) => sum + hp.load, 0);
      const averageLoad = totalLoad / loadedHoists.length;
      
      for (const hp of loadedHoists) {
        const deviation = Math.abs(hp.load - averageLoad) / averageLoad;
        
        if (deviation > 0.5) {
          issues.push({
            type: 'load_imbalance',
            severity: 'warning',
            hoistId: Object.keys(this.loadData.hoistPoints).find(
              key => this.loadData.hoistPoints[key] === hp
            ),
            load: hp.load,
            averageLoad: averageLoad,
            deviation: deviation,
            message: `吊点载荷分布不均，偏差超过50%`
          });
        }
      }
    }
    
    return issues;
  }
}
