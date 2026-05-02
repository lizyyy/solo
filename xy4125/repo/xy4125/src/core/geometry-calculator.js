import * as THREE from 'three';

export class GeometryCalculator {
  constructor() {
    this._tempVector = new THREE.Vector3();
    this._tempVector2 = new THREE.Vector3();
    this._tempBox = new THREE.Box3();
  }

  computeBoundingBox(vertices, transform = null) {
    const box = new THREE.Box3();

    if (!vertices || vertices.length < 3) {
      return box;
    }

    const tempVector = new THREE.Vector3();
    for (let i = 0; i < vertices.length; i += 3) {
      tempVector.set(vertices[i], vertices[i + 1], vertices[i + 2]);
      if (transform) {
        tempVector.applyMatrix4(transform);
      }
      box.expandByPoint(tempVector);
    }

    return box;
  }

  computeBoundingBoxFromGeometry(geometry, matrix = null) {
    const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    
    if (matrix) {
      box.applyMatrix4(matrix);
    }
    
    return box;
  }

  boxIntersects(boxA, boxB) {
    return boxA.intersectsBox(boxB);
  }

  boxContainsBox(container, contained) {
    return container.containsBox(contained);
  }

  boxContainsPoint(box, point) {
    return box.containsPoint(point);
  }

  computeMinimumDistance(verticesA, verticesB, transformA = null, transformB = null) {
    if (!verticesA || !verticesB || verticesA.length === 0 || verticesB.length === 0) {
      return Infinity;
    }

    let minDistance = Infinity;
    const countA = verticesA.length / 3;
    const countB = verticesB.length / 3;

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();

    for (let i = 0; i < countA; i++) {
      vA.set(verticesA[i * 3], verticesA[i * 3 + 1], verticesA[i * 3 + 2]);
      if (transformA) vA.applyMatrix4(transformA);

      for (let j = 0; j < countB; j++) {
        vB.set(verticesB[j * 3], verticesB[j * 3 + 1], verticesB[j * 3 + 2]);
        if (transformB) vB.applyMatrix4(transformB);

        const distance = vA.distanceTo(vB);
        if (distance < minDistance) {
          minDistance = distance;
        }
      }
    }

    return minDistance;
  }

  computeClosestPoints(verticesA, verticesB, transformA = null, transformB = null) {
    if (!verticesA || !verticesB || verticesA.length === 0 || verticesB.length === 0) {
      return { distance: Infinity, pointA: null, pointB: null };
    }

    let minDistance = Infinity;
    let closestPointA = null;
    let closestPointB = null;

    const countA = verticesA.length / 3;
    const countB = verticesB.length / 3;

    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();

    for (let i = 0; i < countA; i++) {
      vA.set(verticesA[i * 3], verticesA[i * 3 + 1], verticesA[i * 3 + 2]);
      if (transformA) vA.applyMatrix4(transformA);

      for (let j = 0; j < countB; j++) {
        vB.set(verticesB[j * 3], verticesB[j * 3 + 1], verticesB[j * 3 + 2]);
        if (transformB) vB.applyMatrix4(transformB);

        const distance = vA.distanceTo(vB);
        if (distance < minDistance) {
          minDistance = distance;
          closestPointA = vA.clone();
          closestPointB = vB.clone();
        }
      }
    }

    return {
      distance: minDistance,
      pointA: closestPointA,
      pointB: closestPointB
    };
  }

  computeBoxMinimumGap(boxA, boxB) {
    if (this.boxIntersects(boxA, boxB)) {
      return 0;
    }

    const clamped = new THREE.Vector3();
    clamped.copy(boxB.min).clamp(boxA.min, boxA.max);
    
    const dx = Math.max(0, boxA.min.x - boxB.max.x, boxB.min.x - boxA.max.x);
    const dy = Math.max(0, boxA.min.y - boxB.max.y, boxB.min.y - boxA.max.y);
    const dz = Math.max(0, boxA.min.z - boxB.max.z, boxB.min.z - boxA.max.z);

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  computeMeshSurfaceArea(geometry) {
    if (!geometry || !geometry.attributes.position) {
      return 0;
    }

    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    
    let surfaceArea = 0;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();

    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        v1.set(positions[i0], positions[i0 + 1], positions[i0 + 2]);
        v2.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
        v3.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);

        e1.subVectors(v2, v1);
        e2.subVectors(v3, v1);

        const crossProduct = new THREE.Vector3().crossVectors(e1, e2);
        surfaceArea += crossProduct.length() * 0.5;
      }
    } else {
      for (let i = 0; i < positions.length; i += 9) {
        v1.set(positions[i], positions[i + 1], positions[i + 2]);
        v2.set(positions[i + 3], positions[i + 4], positions[i + 5]);
        v3.set(positions[i + 6], positions[i + 7], positions[i + 8]);

        e1.subVectors(v2, v1);
        e2.subVectors(v3, v1);

        const crossProduct = new THREE.Vector3().crossVectors(e1, e2);
        surfaceArea += crossProduct.length() * 0.5;
      }
    }

    return surfaceArea;
  }

  computeMeshVolume(geometry) {
    if (!geometry || !geometry.attributes.position) {
      return 0;
    }

    const positions = geometry.attributes.position.array;
    const indices = geometry.index ? geometry.index.array : null;
    
    let volume = 0;
    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();

    const signedVolumeOfTriangle = (a, b, c) => {
      const v321 = c.x * b.y * a.z;
      const v231 = b.x * c.y * a.z;
      const v312 = c.x * a.y * b.z;
      const v132 = a.x * c.y * b.z;
      const v213 = b.x * a.y * c.z;
      const v123 = a.x * b.y * c.z;
      return (1.0 / 6.0) * (-v321 + v231 + v312 - v132 - v213 + v123);
    };

    if (indices) {
      for (let i = 0; i < indices.length; i += 3) {
        const i0 = indices[i] * 3;
        const i1 = indices[i + 1] * 3;
        const i2 = indices[i + 2] * 3;

        v1.set(positions[i0], positions[i0 + 1], positions[i0 + 2]);
        v2.set(positions[i1], positions[i1 + 1], positions[i1 + 2]);
        v3.set(positions[i2], positions[i2 + 1], positions[i2 + 2]);

        volume += signedVolumeOfTriangle(v1, v2, v3);
      }
    } else {
      for (let i = 0; i < positions.length; i += 9) {
        v1.set(positions[i], positions[i + 1], positions[i + 2]);
        v2.set(positions[i + 3], positions[i + 4], positions[i + 5]);
        v3.set(positions[i + 6], positions[i + 7], positions[i + 8]);

        volume += signedVolumeOfTriangle(v1, v2, v3);
      }
    }

    return Math.abs(volume);
  }

  computeBoundingBoxSize(box) {
    if (!box || box.isEmpty()) {
      return { width: 0, height: 0, depth: 0, volume: 0 };
    }

    const size = new THREE.Vector3();
    box.getSize(size);

    return {
      width: size.x,
      height: size.y,
      depth: size.z,
      volume: size.x * size.y * size.z
    };
  }

  computeBoxCenter(box) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }

  expandBoxByPoint(box, point) {
    const expanded = box.clone();
    expanded.expandByPoint(point);
    return expanded;
  }

  transformBox(box, matrix) {
    const transformed = box.clone();
    transformed.applyMatrix4(matrix);
    return transformed;
  }

  createAttachmentBoundingBox(position, size, rotation = 0) {
    const halfSize = new THREE.Vector3(
      size.x / 2,
      size.y / 2,
      size.z / 2
    );

    const box = new THREE.Box3();
    box.min.copy(position).sub(halfSize);
    box.max.copy(position).add(halfSize);

    return box;
  }

  checkRayBoxIntersection(ray, box) {
    return ray.intersectsBox(box);
  }

  getRayBoxIntersection(ray, box) {
    const target = new THREE.Vector3();
    return ray.intersectBox(box, target);
  }
}

export default GeometryCalculator;
