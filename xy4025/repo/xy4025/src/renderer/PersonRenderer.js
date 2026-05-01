import * as THREE from 'three';
import { AnomalyType } from '../models/types.js';

export class PersonRenderer {
  constructor(sceneManager) {
    this.sceneManager = sceneManager;
    this.floorHeight = 4;
    this.personColors = {
      default: 0x4488ff,
      selected: 0xffff00,
      anomaly: 0xff4444
    };
  }

  renderPerson(person, yOffset = 0, isSelected = false) {
    const group = new THREE.Group();
    
    const hasAnomaly = person.analysis && person.analysis.anomalies.length > 0;
    
    let color = this.personColors.default;
    if (isSelected) {
      color = this.personColors.selected;
    } else if (hasAnomaly) {
      color = this.personColors.anomaly;
    }
    
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.2, 4, 8);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.1
    });
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    bodyMesh.position.y = 1;
    bodyMesh.castShadow = true;
    group.add(bodyMesh);
    
    const headGeometry = new THREE.SphereGeometry(0.35, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe4c4,
      roughness: 0.8
    });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.position.y = 2.1;
    headMesh.castShadow = true;
    group.add(headMesh);
    
    if (isSelected) {
      const ringGeometry = new THREE.RingGeometry(0.8, 1.0, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.05;
      group.add(ringMesh);
    }
    
    if (hasAnomaly && !isSelected) {
      const warningGeometry = new THREE.TetrahedronGeometry(0.5);
      const warningMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.8
      });
      const warningMesh = new THREE.Mesh(warningGeometry, warningMaterial);
      warningMesh.position.y = 3.2;
      group.add(warningMesh);
      
      group.userData.warningMesh = warningMesh;
    }
    
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 256;
    nameCanvas.height = 64;
    const nameCtx = nameCanvas.getContext('2d');
    nameCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    nameCtx.fillRect(0, 0, 256, 64);
    nameCtx.fillStyle = 'white';
    nameCtx.font = 'bold 24px Arial';
    nameCtx.textAlign = 'center';
    nameCtx.fillText(person.name, 128, 40);
    
    const nameTexture = new THREE.CanvasTexture(nameCanvas);
    const nameGeometry = new THREE.PlaneGeometry(3, 0.75);
    const nameMaterial = new THREE.MeshBasicMaterial({
      map: nameTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const nameMesh = new THREE.Mesh(nameGeometry, nameMaterial);
    nameMesh.position.y = 2.8;
    group.add(nameMesh);
    
    group.userData = {
      type: 'person',
      data: person,
      clickable: true,
      isSelected,
      hasAnomaly,
      nameMesh
    };
    
    this.sceneManager.addObject(group, 'persons');
    
    return group;
  }

  renderTrajectory(person, yOffset = 0, showFullTrajectory = false) {
    if (person.trajectory.length < 2) return null;
    
    const group = new THREE.Group();
    
    const hasAnomaly = person.analysis && person.analysis.anomalies.length > 0;
    
    const color = hasAnomaly ? 0xff4444 : 0x66aaff;
    
    const points = [];
    for (const trajPoint of person.trajectory) {
      const floorY = yOffset + trajPoint.position.floor * this.floorHeight;
      points.push(new THREE.Vector3(
        trajPoint.position.x,
        floorY + 0.2,
        trajPoint.position.y
      ));
    }
    
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const lineMaterial = new THREE.LineBasicMaterial({
      color,
      linewidth: 2,
      transparent: true,
      opacity: 0.6
    });
    const trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
    group.add(trajectoryLine);
    
    if (showFullTrajectory) {
      const tubeGeometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        points.length * 2,
        0.05,
        8,
        false
      );
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.4
      });
      const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
      group.add(tubeMesh);
      
      if (person.analysis && person.analysis.anomalies.length > 0) {
        for (const anomaly of person.analysis.anomalies) {
          const markerGroup = this.renderAnomalyMarker(anomaly, yOffset);
          if (markerGroup) {
            group.add(markerGroup);
          }
        }
      }
    }
    
    group.userData = {
      type: 'trajectory',
      personId: person.id,
      data: person
    };
    
    this.sceneManager.addObject(group, 'trajectories');
    
    return group;
  }

  renderAnomalyMarker(anomaly, yOffset = 0) {
    const floorY = yOffset + anomaly.position.floor * this.floorHeight;
    
    const group = new THREE.Group();
    
    let color = 0xff6600;
    let size = 0.8;
    
    switch (anomaly.type) {
      case AnomalyType.WRONG_EXIT:
        color = 0xff4444;
        break;
      case AnomalyType.BLOCKED_PATH:
        color = 0xff8800;
        break;
      case AnomalyType.STAY_TOO_LONG:
        color = 0xffff00;
        size = 1.0;
        break;
      case AnomalyType.CONGESTION:
        color = 0xff0088;
        size = 1.2;
        break;
      case AnomalyType.WRONG_DIRECTION:
        color = 0x8844ff;
        break;
    }
    
    const markerGeometry = new THREE.SphereGeometry(size, 16, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7
    });
    const markerMesh = new THREE.Mesh(markerGeometry, markerMaterial);
    markerMesh.position.set(
      anomaly.position.x,
      floorY + 1.5,
      anomaly.position.y
    );
    group.add(markerMesh);
    
    const ringGeometry = new THREE.RingGeometry(size + 0.2, size + 0.4, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.set(
      anomaly.position.x,
      floorY + 0.1,
      anomaly.position.y
    );
    group.add(ringMesh);
    
    group.userData = {
      anomaly,
      type: 'anomaly_marker'
    };
    
    return group;
  }

  updatePersonPosition(personMesh, time, yOffset = 0) {
    const person = personMesh.userData.data;
    if (!person || person.trajectory.length === 0) return;
    
    const position = person.getPositionAt(time);
    if (!position) return;
    
    const floorY = yOffset + position.floor * this.floorHeight;
    
    personMesh.position.set(position.x, floorY, position.y);
    
    if (person.trajectory.length > 1) {
      const nextPos = person.getPositionAt(time + 0.1);
      if (nextPos) {
        const dir = new THREE.Vector3(
          nextPos.x - position.x,
          0,
          nextPos.y - position.y
        );
        if (dir.length() > 0.01) {
          personMesh.lookAt(
            personMesh.position.x + dir.x,
            personMesh.position.y,
            personMesh.position.z + dir.z
          );
        }
      }
    }
    
    if (personMesh.userData.nameMesh) {
      const camera = this.sceneManager.camera;
      personMesh.userData.nameMesh.lookAt(camera.position);
    }
    
    if (personMesh.userData.warningMesh) {
      personMesh.userData.warningMesh.rotation.y += 0.02;
    }
  }

  highlightPerson(personId, highlight = true) {
    const persons = this.sceneManager.getObjectsByCategory('persons');
    for (const personMesh of persons) {
      if (personMesh.userData.data?.id === personId) {
        personMesh.visible = true;
        
        const bodyMesh = personMesh.children.find(child => 
          child.geometry && child.geometry.type === 'CapsuleGeometry'
        );
        if (bodyMesh) {
          bodyMesh.material.color.setHex(
            highlight ? this.personColors.selected : 
            (personMesh.userData.hasAnomaly ? this.personColors.anomaly : this.personColors.default)
          );
        }
      } else if (highlight) {
        personMesh.visible = false;
      } else {
        personMesh.visible = true;
      }
    }
  }

  filterPersons(filterFn) {
    const persons = this.sceneManager.getObjectsByCategory('persons');
    for (const personMesh of persons) {
      const person = personMesh.userData.data;
      personMesh.visible = filterFn ? filterFn(person) : true;
    }
  }

  clearPersons() {
    this.sceneManager.clearCategory('persons');
    this.sceneManager.clearCategory('trajectories');
    this.sceneManager.clearCategory('anomalies');
  }

  renderCongestionEvent(congestionEvent, yOffset = 0) {
    const group = new THREE.Group();
    
    const edge = congestionEvent.edge;
    const from = edge.from.position;
    const to = edge.to.position;
    
    const floorY = yOffset + from.floor * this.floorHeight;
    
    const start = new THREE.Vector3(from.x, floorY + 0.1, from.y);
    const end = new THREE.Vector3(to.x, floorY + 0.1, to.y);
    
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    
    if (length < 0.01) return null;
    
    const geometry = new THREE.BoxGeometry((edge.width || 2) + 1, 0.5, length);
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    const material = new THREE.MeshBasicMaterial({
      color: 0xff0066,
      transparent: true,
      opacity: 0.6
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(center);
    mesh.lookAt(end);
    mesh.rotateX(Math.PI / 2);
    
    const pulseGeometry = new THREE.BoxGeometry((edge.width || 2) + 2, 0.1, length + 2);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0066,
      transparent: true,
      opacity: 0.3
    });
    const pulseMesh = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulseMesh.position.copy(center);
    pulseMesh.lookAt(end);
    pulseMesh.rotateX(Math.PI / 2);
    group.add(pulseMesh);
    
    group.add(mesh);
    
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 256;
    labelCanvas.height = 64;
    const labelCtx = labelCanvas.getContext('2d');
    labelCtx.fillStyle = 'rgba(255, 0, 102, 0.9)';
    labelCtx.font = 'bold 24px Arial';
    labelCtx.textAlign = 'center';
    labelCtx.fillText(`拥堵: ${congestionEvent.personCount}人`, 128, 40);
    
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    const labelGeometry = new THREE.PlaneGeometry(8, 2);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: labelTexture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const labelMesh = new THREE.Mesh(labelGeometry, labelMaterial);
    labelMesh.position.set(center.x, floorY + 3, center.z);
    group.add(labelMesh);
    
    group.userData = {
      type: 'congestion',
      data: congestionEvent
    };
    
    this.sceneManager.addObject(group, 'anomalies');
    
    return group;
  }

  getPersonMesh(personId) {
    const persons = this.sceneManager.getObjectsByCategory('persons');
    return persons.find(mesh => mesh.userData.data?.id === personId);
  }
}

export default PersonRenderer;
