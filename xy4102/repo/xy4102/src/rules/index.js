import * as THREE from 'three';
import { GeometryCalculator } from '../geometry/index.js';

export class RiskAnalyzer {
  constructor() {
    this.geometryCalculator = new GeometryCalculator();
    this.thresholds = {
      blindSpotWarning: 0.05,
      blindSpotCritical: 0.15,
      overlapWarning: 0.2,
      overlapCritical: 0.4,
      passageCoverageMinimum: 0.8,
      parkingCoverageMinimum: 0.6
    };
  }

  analyze(sceneRenderer) {
    const { cameras, walls, pillars, parkings, passages } = sceneRenderer.objects;

    const results = {
      blindSpots: [],
      overlaps: [],
      passageRisks: [],
      parkingRisks: [],
      summary: {
        totalBlindSpots: 0,
        totalOverlaps: 0,
        totalPassageRisks: 0,
        totalParkingRisks: 0,
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0
      }
    };

    const obstacles = [...walls, ...pillars];
    const bounds = this.calculateBounds(sceneRenderer);

    if (cameras.length > 0) {
      const heatMap = this.geometryCalculator.calculateHeatMap(
        cameras.map(c => ({
          id: c.id,
          position: c.mesh.position.clone(),
          rotation: c.mesh.rotation.clone(),
          fov: c.data.fov || 60,
          aspect: c.data.aspect || 16/9,
          near: c.data.near || 0.1,
          far: c.data.far || 50
        })),
        obstacles,
        bounds
      );

      results.blindSpots = this.analyzeBlindSpots(heatMap, bounds);
      results.overlaps = this.analyzeOverlaps(cameras, obstacles);
    } else {
      results.blindSpots = [{
        type: 'critical',
        level: 'critical',
        title: '无摄像头配置',
        description: '当前场景中没有配置任何摄像头，存在严重的监控盲区风险',
        position: { x: 0, z: 0 }
      }];
    }

    results.passageRisks = this.analyzePassages(passages, cameras, obstacles);
    results.parkingRisks = this.analyzeParkings(parkings, cameras, obstacles);

    results.summary.totalBlindSpots = results.blindSpots.length;
    results.summary.totalOverlaps = results.overlaps.length;
    results.summary.totalPassageRisks = results.passageRisks.length;
    results.summary.totalParkingRisks = results.parkingRisks.length;

    const allRisks = [
      ...results.blindSpots,
      ...results.overlaps,
      ...results.passageRisks,
      ...results.parkingRisks
    ];

    results.summary.criticalCount = allRisks.filter(r => r.level === 'critical').length;
    results.summary.warningCount = allRisks.filter(r => r.level === 'warning').length;
    results.summary.infoCount = allRisks.filter(r => r.level === 'info').length;

    return results;
  }

  calculateBounds(sceneRenderer) {
    const { walls, pillars, cameras, parkings, passages } = sceneRenderer.objects;
    const allObjects = [...walls, ...pillars, ...cameras, ...parkings, ...passages];

    if (allObjects.length === 0) {
      return { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const obj of allObjects) {
      if (obj.mesh) {
        minX = Math.min(minX, obj.mesh.position.x - 10);
        maxX = Math.max(maxX, obj.mesh.position.x + 10);
        minZ = Math.min(minZ, obj.mesh.position.z - 10);
        maxZ = Math.max(maxZ, obj.mesh.position.z + 10);
      }
    }

    return { minX, maxX, minZ, maxZ };
  }

  analyzeBlindSpots(heatMap, bounds) {
    const blindSpots = [];
    const { heatData, gridSize } = heatMap;

    const visited = new Set();
    const clusters = [];

    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const cellWidth = width / gridSize;
    const cellDepth = depth / gridSize;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const index = i * gridSize + j;
        if (visited.has(index)) continue;

        const data = heatData[index];
        if (data.isBlindSpot) {
          const cluster = this.floodFill(
            i, j, gridSize, gridSize,
            (x, y) => {
              const idx = x * gridSize + y;
              return heatData[idx]?.isBlindSpot && !visited.has(idx);
            },
            visited
          );

          if (cluster.length > 5) {
            clusters.push(cluster);
          }
        }
      }
    }

    for (const cluster of clusters) {
      const centerI = Math.round(cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length);
      const centerJ = Math.round(cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length);
      
      const centerX = bounds.minX + centerI * cellWidth;
      const centerZ = bounds.minZ + centerJ * cellDepth;

      const area = cluster.length * cellWidth * cellDepth;
      let level = 'warning';
      let title = '监控盲区';
      let description = `该区域存在监控盲区，面积约 ${area.toFixed(2)} 平方米`;

      if (area > 20) {
        level = 'critical';
        title = '严重监控盲区';
        description = `该区域存在严重监控盲区，面积约 ${area.toFixed(2)} 平方米，建议立即增加摄像头`;
      }

      blindSpots.push({
        type: 'blindSpot',
        level,
        title,
        description,
        position: { x: centerX, z: centerZ },
        area,
        clusterSize: cluster.length
      });
    }

    return blindSpots;
  }

  floodFill(startX, startY, width, height, checkFn, visited) {
    const cluster = [];
    const queue = [{ x: startX, y: startY }];
    
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const index = x * width + y;
      
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited.has(index)) continue;
      if (!checkFn(x, y)) continue;

      visited.add(index);
      cluster.push({ x, y });

      queue.push({ x: x + 1, y });
      queue.push({ x: x - 1, y });
      queue.push({ x, y: y + 1 });
      queue.push({ x, y: y - 1 });
    }

    return cluster;
  }

  analyzeOverlaps(cameras, obstacles) {
    const overlaps = [];

    for (let i = 0; i < cameras.length; i++) {
      for (let j = i + 1; j < cameras.length; j++) {
        const cam1 = cameras[i];
        const cam2 = cameras[j];

        const frustum1 = this.geometryCalculator.calculateViewFrustum(
          cam1.mesh.position,
          cam1.mesh.rotation,
          cam1.data.fov || 60,
          cam1.data.aspect || 16/9,
          cam1.data.near || 0.1,
          cam1.data.far || 50
        );

        const frustum2 = this.geometryCalculator.calculateViewFrustum(
          cam2.mesh.position,
          cam2.mesh.rotation,
          cam2.data.fov || 60,
          cam2.data.aspect || 16/9,
          cam2.data.near || 0.1,
          cam2.data.far || 50
        );

        const overlap = this.geometryCalculator.calculateViewFrustumOverlap(frustum1, frustum2);

        if (overlap.overlapRatio > this.thresholds.overlapWarning) {
          let level = 'warning';
          let title = '视锥体重叠';
          let description = `摄像头 ${cam1.id} 和 ${cam2.id} 的视锥体存在 ${(overlap.overlapRatio * 100).toFixed(1)}% 的重叠`;

          if (overlap.overlapRatio > this.thresholds.overlapCritical) {
            level = 'critical';
            title = '严重视锥体重叠';
            description = `摄像头 ${cam1.id} 和 ${cam2.id} 的视锥体存在 ${(overlap.overlapRatio * 100).toFixed(1)}% 的重叠，存在资源浪费`;
          }

          overlaps.push({
            type: 'overlap',
            level,
            title,
            description,
            cameraIds: [cam1.id, cam2.id],
            overlapRatio: overlap.overlapRatio,
            position: {
              x: (cam1.mesh.position.x + cam2.mesh.position.x) / 2,
              z: (cam1.mesh.position.z + cam2.mesh.position.z) / 2
            }
          });
        }
      }
    }

    return overlaps;
  }

  analyzePassages(passages, cameras, obstacles) {
    const risks = [];

    for (const passage of passages) {
      const coverage = this.calculateObjectCoverage(passage, cameras, obstacles);
      
      if (coverage < this.thresholds.passageCoverageMinimum) {
        const isCritical = passage.data.isCritical;
        const level = isCritical ? 'critical' : 'warning';
        const title = isCritical ? '关键通道覆盖不足' : '通道覆盖不足';
        const description = `通道 ${passage.id} 的监控覆盖率仅为 ${(coverage * 100).toFixed(1)}%，${isCritical ? '作为关键通道，' : ''}建议增加摄像头覆盖`;

        risks.push({
          type: 'passage',
          level,
          title,
          description,
          passageId: passage.id,
          coverage,
          isCritical,
          position: { x: passage.mesh.position.x, z: passage.mesh.position.z }
        });
      }
    }

    return risks;
  }

  analyzeParkings(parkings, cameras, obstacles) {
    const risks = [];

    for (const parking of parkings) {
      const coverage = this.calculateObjectCoverage(parking, cameras, obstacles);
      
      if (coverage < this.thresholds.parkingCoverageMinimum) {
        risks.push({
          type: 'parking',
          level: 'warning',
          title: '车位覆盖不足',
          description: `车位 ${parking.id} (${parking.data.label || '未命名'}) 的监控覆盖率仅为 ${(coverage * 100).toFixed(1)}%`,
          parkingId: parking.id,
          label: parking.data.label,
          coverage,
          position: { x: parking.mesh.position.x, z: parking.mesh.position.z }
        });
      }
    }

    return risks;
  }

  calculateObjectCoverage(obj, cameras, obstacles) {
    if (cameras.length === 0) return 0;

    const mesh = obj.mesh;
    const box = new THREE.Box3().setFromObject(mesh);
    
    const minX = box.min.x;
    const maxX = box.max.x;
    const minZ = box.min.z;
    const maxZ = box.max.z;

    const gridSize = 20;
    let coveredPoints = 0;
    let totalPoints = 0;

    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const x = minX + (maxX - minX) * (i / gridSize);
        const z = minZ + (maxZ - minZ) * (j / gridSize);
        const point = new THREE.Vector3(x, 0.5, z);
        
        totalPoints++;
        
        for (const camera of cameras) {
          const viewFrustum = this.geometryCalculator.calculateViewFrustum(
            camera.mesh.position,
            camera.mesh.rotation,
            camera.data.fov || 60,
            camera.data.aspect || 16/9,
            camera.data.near || 0.1,
            camera.data.far || 50
          );

          if (viewFrustum.frustum.containsPoint(point)) {
            const isBlocked = this.geometryCalculator.checkPointBlocked(
              camera.mesh.position,
              point,
              obstacles
            );

            if (!isBlocked) {
              coveredPoints++;
              break;
            }
          }
        }
      }
    }

    return coveredPoints / totalPoints;
  }

  getRiskLevelColor(level) {
    switch (level) {
      case 'critical': return '#ff4444';
      case 'warning': return '#ffaa00';
      case 'info': return '#00aaff';
      default: return '#888888';
    }
  }
}

export default RiskAnalyzer;
