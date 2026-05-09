import * as THREE from 'three';
import { generateId, distance2D, clamp, formatNumber } from './utils.js';
import { DEFAULT_CONFIG, COLORS } from './config.js';

export class SensorManager {
  constructor(scene, config = {}) {
    this.scene = scene;
    this.config = { ...DEFAULT_CONFIG.sensor, ...config.sensor };
    this.roomConfig = { ...DEFAULT_CONFIG.room, ...config.room };
    this.sensors = [];
    this.sensorMeshes = new Map();
    this.coverageMeshes = new Map();
    this.anomalyMarkers = [];
    this.selectedSensorId = null;
    this.heatmapMesh = null;
    this.heatmapData = null;
    
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }
  
  setRoomConfig(config) {
    this.roomConfig = { ...this.roomConfig, ...config };
    this.validateAllSensors();
    this.updateHeatmap();
  }
  
  setSensorConfig(config) {
    this.config = { ...this.config, ...config };
    this.validateAllSensors();
    this.updateAllCoverageMeshes();
    this.updateHeatmap();
  }
  
  addSensor(x, z, y = null) {
    const sensorY = y ?? this.config.height;
    
    const clampedX = clamp(x, 0.5, this.roomConfig.width - 0.5);
    const clampedZ = clamp(z, 0.5, this.roomConfig.depth - 0.5);
    
    const sensor = {
      id: generateId(),
      name: `传感器 ${this.sensors.length + 1}`,
      x: formatNumber(clampedX),
      y: formatNumber(sensorY),
      z: formatNumber(clampedZ),
      radius: this.config.radius,
      anomalies: []
    };
    
    this.sensors.push(sensor);
    this.createSensorMesh(sensor);
    this.validateSensor(sensor);
    this.updateHeatmap();
    
    return sensor;
  }
  
  removeSensor(id) {
    const index = this.sensors.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    const sensor = this.sensors[index];
    
    const mesh = this.sensorMeshes.get(id);
    if (mesh) {
      this.scene.remove(mesh);
      this.sensorMeshes.delete(id);
    }
    
    const coverage = this.coverageMeshes.get(id);
    if (coverage) {
      this.scene.remove(coverage);
      this.coverageMeshes.delete(id);
    }
    
    this.sensors.splice(index, 1);
    
    if (this.selectedSensorId === id) {
      this.selectedSensorId = null;
    }
    
    this.validateAllSensors();
    this.updateHeatmap();
    
    return true;
  }
  
  clearAll() {
    for (const sensor of this.sensors) {
      const mesh = this.sensorMeshes.get(sensor.id);
      if (mesh) this.scene.remove(mesh);
      
      const coverage = this.coverageMeshes.get(sensor.id);
      if (coverage) this.scene.remove(coverage);
    }
    
    this.sensors = [];
    this.sensorMeshes.clear();
    this.coverageMeshes.clear();
    this.selectedSensorId = null;
    this.clearAnomalyMarkers();
    this.removeHeatmap();
    
    this.updateHeatmap();
  }
  
  updateSensorPosition(id, x, z) {
    const sensor = this.sensors.find(s => s.id === id);
    if (!sensor) return false;
    
    const clampedX = clamp(x, 0.5, this.roomConfig.width - 0.5);
    const clampedZ = clamp(z, 0.5, this.roomConfig.depth - 0.5);
    
    sensor.x = formatNumber(clampedX);
    sensor.z = formatNumber(clampedZ);
    
    const mesh = this.sensorMeshes.get(id);
    if (mesh) {
      mesh.position.x = clampedX;
      mesh.position.z = clampedZ;
    }
    
    const coverage = this.coverageMeshes.get(id);
    if (coverage) {
      coverage.position.x = clampedX;
      coverage.position.z = clampedZ;
    }
    
    this.validateAllSensors();
    this.updateHeatmap();
    
    return true;
  }
  
  createSensorMesh(sensor) {
    const geometry = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 16);
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.sensor,
      metalness: 0.8,
      roughness: 0.2,
      emissive: COLORS.sensor,
      emissiveIntensity: 0.3
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(sensor.x, sensor.y, sensor.z);
    mesh.userData = { sensorId: sensor.id, type: 'sensor' };
    
    this.scene.add(mesh);
    this.sensorMeshes.set(sensor.id, mesh);
    
    this.createCoverageMesh(sensor);
    
    return mesh;
  }
  
  createCoverageMesh(sensor) {
    const geometry = new THREE.SphereGeometry(sensor.radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: COLORS.coverageSphere,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(sensor.x, sensor.y, sensor.z);
    
    const wireframe = new THREE.WireframeGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: COLORS.coverageSphere,
      transparent: true,
      opacity: 0.3
    });
    const lines = new THREE.LineSegments(wireframe, lineMaterial);
    mesh.add(lines);
    
    this.scene.add(mesh);
    this.coverageMeshes.set(sensor.id, mesh);
    
    return mesh;
  }
  
  updateAllCoverageMeshes() {
    for (const sensor of this.sensors) {
      const oldMesh = this.coverageMeshes.get(sensor.id);
      if (oldMesh) {
        this.scene.remove(oldMesh);
      }
      
      sensor.radius = this.config.radius;
      this.createCoverageMesh(sensor);
    }
  }
  
  setSelectedSensor(id) {
    if (this.selectedSensorId) {
      const oldMesh = this.sensorMeshes.get(this.selectedSensorId);
      if (oldMesh) {
        oldMesh.material.color.setHex(COLORS.sensor);
        oldMesh.material.emissive.setHex(COLORS.sensor);
      }
    }
    
    this.selectedSensorId = id;
    
    if (id) {
      const mesh = this.sensorMeshes.get(id);
      if (mesh) {
        mesh.material.color.setHex(COLORS.sensorSelected);
        mesh.material.emissive.setHex(COLORS.sensorSelected);
      }
    }
  }
  
  validateSensor(sensor) {
    sensor.anomalies = [];
    
    if (sensor.x < 0 || sensor.x > this.roomConfig.width ||
        sensor.z < 0 || sensor.z > this.roomConfig.depth) {
      sensor.anomalies.push({
        type: 'boundary',
        severity: 'error',
        message: '传感器超出房间边界'
      });
    }
    
    for (const other of this.sensors) {
      if (other.id === sensor.id) continue;
      
      const dist = distance2D(sensor.x, sensor.z, other.x, other.z);
      
      if (dist < this.config.minDistance) {
        sensor.anomalies.push({
          type: 'dense',
          severity: 'warning',
          message: `距离 ${other.name} 过近 (${formatNumber(dist)}m)`,
          relatedSensor: other.id,
          distance: dist
        });
      }
    }
    
    const mesh = this.sensorMeshes.get(sensor.id);
    if (mesh) {
      if (sensor.anomalies.some(a => a.severity === 'error')) {
        mesh.material.color.setHex(COLORS.error);
        mesh.material.emissive.setHex(COLORS.error);
      } else if (sensor.anomalies.some(a => a.severity === 'warning')) {
        mesh.material.color.setHex(COLORS.warning);
        mesh.material.emissive.setHex(COLORS.warning);
      } else {
        mesh.material.color.setHex(
          this.selectedSensorId === sensor.id ? COLORS.sensorSelected : COLORS.sensor
        );
        mesh.material.emissive.setHex(
          this.selectedSensorId === sensor.id ? COLORS.sensorSelected : COLORS.sensor
        );
      }
    }
  }
  
  validateAllSensors() {
    this.clearAnomalyMarkers();
    
    for (const sensor of this.sensors) {
      this.validateSensor(sensor);
    }
    
    this.findGapRegions();
  }
  
  findGapRegions() {
    const resolution = DEFAULT_CONFIG.heatmap.resolution;
    const width = this.roomConfig.width;
    const depth = this.roomConfig.depth;
    const radius = this.config.radius;
    
    const gaps = [];
    const stepsX = Math.ceil(width / resolution);
    const stepsZ = Math.ceil(depth / resolution);
    
    for (let i = 0; i < stepsX; i++) {
      for (let j = 0; j < stepsZ; j++) {
        const x = (i + 0.5) * resolution;
        const z = (j + 0.5) * resolution;
        
        let covered = false;
        for (const sensor of this.sensors) {
          const dist = distance2D(x, z, sensor.x, sensor.z);
          if (dist <= radius) {
            covered = true;
            break;
          }
        }
        
        if (!covered) {
          gaps.push({ x, z });
        }
      }
    }
    
    const clusteredGaps = this.clusterGaps(gaps, resolution * 2);
    
    for (const gap of clusteredGaps) {
      this.addAnomalyMarker(gap.x, gap.z, 'error', '漏测区域');
    }
    
    return clusteredGaps;
  }
  
  clusterGaps(gaps, threshold) {
    const clusters = [];
    const visited = new Set();
    
    for (let i = 0; i < gaps.length; i++) {
      if (visited.has(i)) continue;
      
      const cluster = [gaps[i]];
      visited.add(i);
      let changed = true;
      
      while (changed) {
        changed = false;
        for (let j = 0; j < gaps.length; j++) {
          if (visited.has(j)) continue;
          
          for (const point of cluster) {
            const dist = distance2D(point.x, point.z, gaps[j].x, gaps[j].z);
            if (dist <= threshold) {
              cluster.push(gaps[j]);
              visited.add(j);
              changed = true;
              break;
            }
          }
        }
      }
      
      if (cluster.length > 4) {
        const centerX = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
        const centerZ = cluster.reduce((sum, p) => sum + p.z, 0) / cluster.length;
        clusters.push({ x: centerX, z: centerZ, count: cluster.length });
      }
    }
    
    return clusters;
  }
  
  addAnomalyMarker(x, z, severity, message) {
    const height = severity === 'error' ? 0.8 : 0.6;
    const geometry = new THREE.ConeGeometry(0.3, height, 4);
    const material = new THREE.MeshBasicMaterial({
      color: severity === 'error' ? COLORS.error : COLORS.warning,
      transparent: true,
      opacity: 0.8
    });
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(x, height / 2 + 0.01, z);
    marker.rotation.y = Math.PI / 4;
    marker.userData = { type: 'anomaly', severity, message };
    
    this.scene.add(marker);
    this.anomalyMarkers.push(marker);
  }
  
  clearAnomalyMarkers() {
    for (const marker of this.anomalyMarkers) {
      this.scene.remove(marker);
    }
    this.anomalyMarkers = [];
  }
  
  updateHeatmap() {
    this.removeHeatmap();
    
    const resolution = DEFAULT_CONFIG.heatmap.resolution;
    const width = this.roomConfig.width;
    const depth = this.roomConfig.depth;
    const radius = this.config.radius;
    const colors = DEFAULT_CONFIG.heatmap.colors;
    
    const stepsX = Math.ceil(width / resolution);
    const stepsZ = Math.ceil(depth / resolution);
    
    const geometry = new THREE.PlaneGeometry(width, depth, stepsX - 1, stepsZ - 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(width / 2, 0.02, depth / 2);
    
    const positions = geometry.attributes.position;
    const colorsArray = new Float32Array(positions.count * 3);
    
    let coveredCount = 0;
    let totalCount = 0;
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      
      let maxCoverage = 0;
      totalCount++;
      
      for (const sensor of this.sensors) {
        const dist = distance2D(x, z, sensor.x, sensor.z);
        if (dist <= radius) {
          const coverage = 1 - (dist / radius);
          maxCoverage = Math.max(maxCoverage, coverage);
        }
      }
      
      if (maxCoverage > 0) {
        coveredCount++;
      }
      
      const color = maxCoverage > 0
        ? this.getCoverageColor(maxCoverage, colors)
        : [0.1, 0.1, 0.2];
      
      colorsArray[i * 3] = color[0];
      colorsArray[i * 3 + 1] = color[1];
      colorsArray[i * 3 + 2] = color[2];
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.7
    });
    
    this.heatmapMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.heatmapMesh);
    
    this.heatmapData = {
      coverage: totalCount > 0 ? (coveredCount / totalCount) * 100 : 0,
      totalPoints: totalCount,
      coveredPoints: coveredCount
    };
  }
  
  getCoverageColor(value, colorScale) {
    for (let i = 0; i < colorScale.length - 1; i++) {
      const c1 = colorScale[i];
      const c2 = colorScale[i + 1];
      
      if (value >= c1.value && value <= c2.value) {
        const t = (value - c1.value) / (c2.value - c1.value);
        return [
          c1.color[0] + (c2.color[0] - c1.color[0]) * t,
          c1.color[1] + (c2.color[1] - c1.color[1]) * t,
          c1.color[2] + (c2.color[2] - c1.color[2]) * t
        ];
      }
    }
    
    return colorScale[colorScale.length - 1].color;
  }
  
  removeHeatmap() {
    if (this.heatmapMesh) {
      this.scene.remove(this.heatmapMesh);
      this.heatmapMesh = null;
    }
  }
  
  setHeatmapVisible(visible) {
    if (this.heatmapMesh) {
      this.heatmapMesh.visible = visible;
    }
  }
  
  setCoverageVisible(visible) {
    for (const mesh of this.coverageMeshes.values()) {
      mesh.visible = visible;
    }
  }
  
  setAnomaliesVisible(visible) {
    for (const marker of this.anomalyMarkers) {
      marker.visible = visible;
    }
  }
  
  getStatistics() {
    const denseCount = this.sensors.filter(s => 
      s.anomalies.some(a => a.type === 'dense')
    ).length;
    
    const gapCount = this.anomalyMarkers.filter(m => 
      m.userData.severity === 'error'
    ).length;
    
    return {
      count: this.sensors.length,
      coverage: this.heatmapData?.coverage ?? 0,
      denseCount,
      gapCount
    };
  }
  
  getReportData() {
    return {
      timestamp: new Date().toISOString(),
      room: { ...this.roomConfig },
      sensorConfig: { ...this.config },
      sensors: this.sensors.map(s => ({
        ...s,
        anomalies: s.anomalies
      })),
      statistics: this.getStatistics()
    };
  }
  
  toJSON() {
    return {
      room: { ...this.roomConfig },
      sensorConfig: { ...this.config },
      sensors: this.sensors.map(s => ({
        id: s.id,
        name: s.name,
        x: s.x,
        y: s.y,
        z: s.z,
        radius: s.radius
      }))
    };
  }
  
  fromJSON(data) {
    this.clearAll();
    
    if (data.room) {
      this.setRoomConfig(data.room);
    }
    
    if (data.sensorConfig) {
      this.setSensorConfig(data.sensorConfig);
    }
    
    if (data.sensors) {
      for (const sensorData of data.sensors) {
        const sensor = this.addSensor(sensorData.x, sensorData.z, sensorData.y);
        if (sensorData.name) {
          sensor.name = sensorData.name;
        }
        if (sensorData.id) {
          sensor.id = sensorData.id;
        }
      }
    }
  }
}
