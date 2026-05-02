import * as THREE from 'three';

export class GeometryCalculator {
  constructor() {}

  calculateViewFrustum(position, rotation, fov = 60, aspect = 16/9, near = 0.1, far = 50) {
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.copy(position);
    camera.rotation.copy(rotation);
    camera.updateMatrixWorld();

    const frustum = new THREE.Frustum();
    frustum.setFromProjectionMatrix(
      new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      )
    );

    const vertices = this.getFrustumVertices(camera);
    
    return {
      frustum,
      vertices,
      camera,
      position: position.clone(),
      rotation: rotation.clone(),
      fov,
      aspect,
      near,
      far
    };
  }

  getFrustumVertices(camera) {
    const near = camera.near;
    const far = camera.far;
    const fov = camera.fov * (Math.PI / 180);
    const aspect = camera.aspect;

    const nearHeight = 2 * Math.tan(fov / 2) * near;
    const nearWidth = nearHeight * aspect;
    const farHeight = 2 * Math.tan(fov / 2) * far;
    const farWidth = farHeight * aspect;

    const vertices = [
      new THREE.Vector3(-nearWidth/2, -nearHeight/2, -near),
      new THREE.Vector3(nearWidth/2, -nearHeight/2, -near),
      new THREE.Vector3(nearWidth/2, nearHeight/2, -near),
      new THREE.Vector3(-nearWidth/2, nearHeight/2, -near),
      new THREE.Vector3(-farWidth/2, -farHeight/2, -far),
      new THREE.Vector3(farWidth/2, -farHeight/2, -far),
      new THREE.Vector3(farWidth/2, farHeight/2, -far),
      new THREE.Vector3(-farWidth/2, farHeight/2, -far)
    ];

    const matrix = camera.matrixWorld;
    vertices.forEach(v => v.applyMatrix4(matrix));

    return vertices;
  }

  calculateCoverageArea(viewFrustum, obstacles = []) {
    const { frustum, far } = viewFrustum;
    const coveragePoints = [];
    const blockedPoints = [];

    const gridSize = 50;
    const halfWidth = 30;
    const halfDepth = 30;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = (i / gridSize - 0.5) * halfWidth * 2;
        const z = (j / gridSize - 0.5) * halfDepth * 2;
        const point = new THREE.Vector3(x, 0, z);

        if (frustum.containsPoint(point)) {
          const isBlocked = this.checkPointBlocked(
            viewFrustum.position,
            point,
            obstacles
          );

          if (isBlocked) {
            blockedPoints.push(point);
          } else {
            coveragePoints.push(point);
          }
        }
      }
    }

    return {
      coveragePoints,
      blockedPoints,
      totalPoints: coveragePoints.length + blockedPoints.length,
      coverageRatio: coveragePoints.length / (coveragePoints.length + blockedPoints.length || 1)
    };
  }

  checkPointBlocked(cameraPos, point, obstacles) {
    const direction = new THREE.Vector3().subVectors(point, cameraPos);
    const distance = direction.length();
    direction.normalize();

    const raycaster = new THREE.Raycaster(cameraPos, direction, 0.1, distance);

    for (const obstacle of obstacles) {
      if (obstacle.mesh) {
        const intersects = raycaster.intersectObject(obstacle.mesh);
        if (intersects.length > 0) {
          return true;
        }
      }
    }

    return false;
  }

  calculateViewFrustumOverlap(frustum1, frustum2) {
    const points1 = frustum1.vertices;
    const points2 = frustum2.vertices;

    let overlappingPoints = 0;
    const totalPoints = points1.length + points2.length;

    for (const point of points1) {
      if (frustum2.frustum.containsPoint(point)) {
        overlappingPoints++;
      }
    }

    for (const point of points2) {
      if (frustum1.frustum.containsPoint(point)) {
        overlappingPoints++;
      }
    }

    const overlapRatio = overlappingPoints / totalPoints;
    
    return {
      overlapRatio,
      overlappingPoints,
      totalPoints,
      isSignificant: overlapRatio > 0.3
    };
  }

  calculateHeatMap(cameras, obstacles, bounds) {
    const { minX, maxX, minZ, maxZ } = bounds;
    const gridSize = 100;
    const heatData = [];

    const width = maxX - minX;
    const depth = maxZ - minZ;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = minX + (i / gridSize) * width;
        const z = minZ + (j / gridSize) * depth;
        const point = new THREE.Vector3(x, 0, z);

        let coverageCount = 0;
        let visibleCameras = [];

        for (const camera of cameras) {
          const viewFrustum = this.calculateViewFrustum(
            camera.position,
            camera.rotation,
            camera.fov,
            camera.aspect,
            camera.near,
            camera.far
          );

          if (viewFrustum.frustum.containsPoint(point)) {
            const isBlocked = this.checkPointBlocked(
              camera.position,
              point,
              obstacles
            );

            if (!isBlocked) {
              coverageCount++;
              visibleCameras.push(camera.id);
            }
          }
        }

        heatData.push({
          x,
          z,
          coverageCount,
          visibleCameras,
          isBlindSpot: coverageCount === 0
        });
      }
    }

    return {
      heatData,
      gridSize,
      bounds,
      blindSpots: heatData.filter(d => d.isBlindSpot),
      maxCoverage: Math.max(...heatData.map(d => d.coverageCount))
    };
  }

  pointInPolygon(point, polygon) {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x, zi = polygon[i].z;
      const xj = polygon[j].x, zj = polygon[j].z;

      if (((zi > point.z) !== (zj > point.z)) &&
          (point.x < (xj - xi) * (point.z - zi) / (zj - zi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  calculateAABB(objects) {
    if (objects.length === 0) {
      return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const obj of objects) {
      if (obj.boundingBox) {
        minX = Math.min(minX, obj.boundingBox.min.x);
        maxX = Math.max(maxX, obj.boundingBox.max.x);
        minZ = Math.min(minZ, obj.boundingBox.min.z);
        maxZ = Math.max(maxZ, obj.boundingBox.max.z);
      }
    }

    return { minX, maxX, minZ, maxZ };
  }
}

export default GeometryCalculator;
