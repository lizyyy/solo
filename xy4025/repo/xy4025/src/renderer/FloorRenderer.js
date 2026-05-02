import * as THREE from 'three';
import { ConnectionType } from '../models/types.js';

export class FloorRenderer {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.floorHeight = 4;
  }

  renderFloor(floor, yOffset = 0) {
    const group = new THREE.Group();
    group.name = `floor_${floor.id}`;
    
    const floorY = yOffset + floor.level * this.floorHeight;
    
    const floorGeometry = new THREE.PlaneGeometry(100, 80);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      roughness: 0.8,
      metalness: 0.2,
      transparent: true,
      opacity: 0.9
    });
    const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = floorY;
    floorMesh.receiveShadow = true;
    group.add(floorMesh);
    
    const gridGeometry = new THREE.PlaneGeometry(100, 80, 10, 8);
    const gridMaterial = new THREE.MeshBasicMaterial({
      color: 0x555577,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    const gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = floorY + 0.01;
    group.add(gridMesh);
    
    const borderGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(100, 0.1, 80));
    const borderMaterial = new THREE.LineBasicMaterial({
      color: 0x6666aa,
      linewidth: 2
    });
    const borderLine = new THREE.LineSegments(borderGeometry, borderMaterial);
    borderLine.position.y = floorY + 0.05;
    group.add(borderLine);
    
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const labelCtx = labelCanvas.getContext('2d');
    labelCtx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    labelCtx.font = 'bold 32px Arial';
    labelCtx.textAlign = 'center';
    labelCtx.fillText(floor.name, 128, 40);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelGeometry = new THREE.PlaneGeometry(10, 2.5);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.rotation.x = -Math.PI / 2;
    labelMesh.position.set(0, floorY + 0.2, 35);
    group.add(labelMesh);
    
    group.userData = {
      type: 'floor',
      data: floor,
      floorLevel: floor.level
    };
    
    this.sceneManager.addObject(group, 'floors');
    
    return group;
  }

  renderEdge(edge, yOffset = 0) {
    const from = edge.from.position;
    const to = edge.to.position;
    const floorY = yOffset + from.floor * this.floorHeight;
    
    const start = new THREE.Vector3(from.x, floorY + 0.1, from.y);
    const end = new THREE.Vector3(to.x, floorY + 0.1, to.y);
    
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    if (length < 0.01) return null;
    
    const geometry = new THREE.BoxGeometry(edge.width || 2, 0.1, length);
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    let color = 0x4a4a6a;
    
    if (edge.isBlocked) {
      color = 0xff4444;
    } else if (edge.type === ConnectionType.STAIRCASE) {
      color = 0x66aa66;
    } else if (edge.type === ConnectionType.ELEVATOR) {
      color = 0x6666aa;
    }
    
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.6,
      metalness: 0.2,
      transparent: edge.isBlocked,
      opacity: edge.isBlocked ? 0.7 : 1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.lookAt(end);
    mesh.rotateX(Math.PI / 2);
    mesh.receiveShadow = true;
    
    mesh.userData = {
      type: 'edge',
      data: edge,
      clickable: true
    };
    
    this.sceneManager.addObject(mesh, 'edges');
    
    return mesh;
  }

  renderExit(exit, yOffset = 0) {
    const pos = exit.position;
    const floorY = yOffset + pos.floor * this.floorHeight;
    
    const group = new THREE.Group();
    
    const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.2, 8);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: exit.isSafe ? 0x00cc00 : 0xff6600,
      roughness: 0.5,
      metalness: 0.3,
      emissive: exit.isSafe ? 0x004400 : 0x442200,
      emissiveIntensity: 0.3
    });
    const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);
    baseMesh.position.set(pos.x, floorY + 0.1, pos.y);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);
    
    const signGeometry = new THREE.ConeGeometry(1.5, 3, 4);
    const signMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      emissive: 0x008800,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.8
    });
    const signMesh = new THREE.Mesh(signGeometry, signMaterial);
    signMesh.position.set(pos.x, floorY + 2.5, pos.y);
    signMesh.rotation.y = Math.PI / 4;
    signMesh.castShadow = true;
    group.add(signMesh);
    
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 128;
    labelCanvas.height = 32;
    const labelCtx = labelCanvas.getContext('2d');
    labelCtx.fillStyle = 'rgba(0, 255, 0, 0.9)';
    labelCtx.font = 'bold 20px Arial';
    labelCtx.textAlign = 'center';
    labelCtx.fillText(exit.id, 64, 22);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelGeometry = new THREE.PlaneGeometry(4, 1);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(pos.x, floorY + 4.5, pos.y);
    group.add(labelMesh);
    
    group.userData = {
      type: 'exit',
      data: exit,
      clickable: true
    };
    
    this.sceneManager.addObject(group, 'exits');
    
    return group;
  }

  renderStairConnection(fromFloor, toFloor, fromPos, toPos, yOffset = 0) {
    const group = new THREE.Group();
    
    const fromY = yOffset + fromFloor * this.floorHeight;
    const toY = yOffset + toFloor * this.floorHeight;
    
    const steps = Math.abs(toFloor - fromFloor) * 4;
    const stepHeight = (toY - fromY) / steps;
    
    const direction = toFloor > fromFloor ? 1 : -1;
    
    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      const stepY = fromY + i * stepHeight;
      
      const x = fromPos.x + (toPos.x - fromPos.x) * progress;
      const z = fromPos.y + (toPos.y - fromPos.y) * progress;
      
      const stepGeometry = new THREE.BoxGeometry(3, stepHeight * 0.8, 3);
      const stepMaterial = new THREE.MeshStandardMaterial({
        color: 0x888899,
        roughness: 0.7,
        metalness: 0.2
      });
      const stepMesh = new THREE.Mesh(stepGeometry, stepMaterial);
      stepMesh.position.set(x, stepY + stepHeight * 0.4, z);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      group.add(stepMesh);
    }
    
    const linePoints = [];
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const x = fromPos.x + (toPos.x - fromPos.x) * progress;
      const y = fromY + i * stepHeight;
      const z = fromPos.y + (toPos.y - fromPos.y) * progress;
      linePoints.push(new THREE.Vector3(x, y, z));
    }
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x66aa66,
      linewidth: 3
    });
    const line = new THREE.Line(lineGeometry, lineMaterial);
    group.add(line);
    
    this.sceneManager.addObject(group, 'edges');
    
    return group;
  }

  clearFloors() {
    this.sceneManager.clearCategory('floors');
    this.sceneManager.clearCategory('edges');
    this.sceneManager.clearCategory('exits');
  }

  setFloorVisibility(floorLevel, visible) {
    const floors = this.sceneManager.getObjectsByCategory('floors');
    for (const floor of floors) {
      if (floor.userData.floorLevel === floorLevel) {
        floor.visible = visible;
      }
    }
    
    const edges = this.sceneManager.getObjectsByCategory('edges');
    for (const edge of edges) {
      if (edge.userData.data?.from?.position?.floor === floorLevel) {
        edge.visible = visible;
      }
    }
    
    const exits = this.sceneManager.getObjectsByCategory('exits');
    for (const exit of exits) {
      if (exit.userData.data?.position?.floor === floorLevel) {
        exit.visible = visible;
      }
    }
  }
}

export default FloorRenderer;
