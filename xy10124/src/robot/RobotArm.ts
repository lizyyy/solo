import * as THREE from 'three';
import { JointState, Pose, Vector3D } from '../types';

interface Link {
  mesh: THREE.Object3D;
  length: number;
  rotationAxis: 'x' | 'y' | 'z';
  offset: THREE.Vector3;
}

export class RobotArm {
  private group: THREE.Group;
  private links: Link[] = [];
  private jointAngles: number[] = [0, 0, 0, 0, 0, 0];
  private linkLengths = [0.15, 0.5, 0.5, 0.1, 0.1, 0.1];

  constructor() {
    this.group = new THREE.Group();
    this.buildArm();
  }

  private buildArm(): void {
    const baseGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 32);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a3a5a,
      roughness: 0.7,
      metalness: 0.3
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = 0.15;
    base.castShadow = true;
    base.receiveShadow = true;
    this.group.add(base);

    const joint1Pivot = new THREE.Group();
    joint1Pivot.position.set(0, 0.3, 0);
    this.group.add(joint1Pivot);

    const link1Geometry = new THREE.BoxGeometry(0.18, 0.25, 0.18);
    const linkMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a90d9,
      roughness: 0.5,
      metalness: 0.4
    });
    const link1Mesh = new THREE.Mesh(link1Geometry, linkMaterial);
    link1Mesh.position.y = 0.125;
    link1Mesh.castShadow = true;
    joint1Pivot.add(link1Mesh);

    const joint1RingGeometry = new THREE.TorusGeometry(0.12, 0.02, 16, 32);
    const jointMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6b6b,
      roughness: 0.4,
      metalness: 0.6
    });
    const joint1Ring = new THREE.Mesh(joint1RingGeometry, jointMaterial);
    joint1Ring.rotation.x = Math.PI / 2;
    joint1Ring.position.y = 0.25;
    joint1Pivot.add(joint1Ring);

    this.links.push({
      mesh: joint1Pivot,
      length: 0.25,
      rotationAxis: 'y',
      offset: new THREE.Vector3(0, 0.3, 0)
    });

    const joint2Pivot = new THREE.Group();
    joint2Pivot.position.set(0, 0.25, 0);
    joint1Pivot.add(joint2Pivot);

    const link2Geometry = new THREE.BoxGeometry(0.12, 0.5, 0.12);
    const link2Mesh = new THREE.Mesh(link2Geometry, linkMaterial);
    link2Mesh.position.y = 0.25;
    link2Mesh.castShadow = true;
    joint2Pivot.add(link2Mesh);

    const joint2Ring = new THREE.Mesh(joint1RingGeometry, jointMaterial);
    joint2Ring.rotation.z = Math.PI / 2;
    joint2Ring.position.z = 0;
    joint2Pivot.add(joint2Ring);

    this.links.push({
      mesh: joint2Pivot,
      length: 0.5,
      rotationAxis: 'x',
      offset: new THREE.Vector3(0, 0.25, 0)
    });

    const joint3Pivot = new THREE.Group();
    joint3Pivot.position.set(0, 0.5, 0);
    joint2Pivot.add(joint3Pivot);

    const link3Geometry = new THREE.BoxGeometry(0.12, 0.5, 0.12);
    const link3Mesh = new THREE.Mesh(link3Geometry, linkMaterial);
    link3Mesh.position.y = 0.25;
    link3Mesh.castShadow = true;
    joint3Pivot.add(link3Mesh);

    const joint3Ring = new THREE.Mesh(joint1RingGeometry, jointMaterial);
    joint3Ring.rotation.z = Math.PI / 2;
    joint3Pivot.add(joint3Ring);

    this.links.push({
      mesh: joint3Pivot,
      length: 0.5,
      rotationAxis: 'x',
      offset: new THREE.Vector3(0, 0.5, 0)
    });

    const joint4Pivot = new THREE.Group();
    joint4Pivot.position.set(0, 0.5, 0);
    joint3Pivot.add(joint4Pivot);

    const link4Geometry = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 16);
    const link4Mesh = new THREE.Mesh(link4Geometry, linkMaterial);
    link4Mesh.castShadow = true;
    joint4Pivot.add(link4Mesh);

    this.links.push({
      mesh: joint4Pivot,
      length: 0.1,
      rotationAxis: 'y',
      offset: new THREE.Vector3(0, 0.5, 0)
    });

    const joint5Pivot = new THREE.Group();
    joint5Pivot.position.set(0, 0.1, 0);
    joint4Pivot.add(joint5Pivot);

    const link5Geometry = new THREE.BoxGeometry(0.1, 0.08, 0.08);
    const link5Mesh = new THREE.Mesh(link5Geometry, linkMaterial);
    link5Mesh.castShadow = true;
    joint5Pivot.add(link5Mesh);

    this.links.push({
      mesh: joint5Pivot,
      length: 0.08,
      rotationAxis: 'x',
      offset: new THREE.Vector3(0, 0.1, 0)
    });

    const joint6Pivot = new THREE.Group();
    joint6Pivot.position.set(0.05, 0, 0);
    joint5Pivot.add(joint6Pivot);

    const flangeGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 16);
    const flangeMesh = new THREE.Mesh(flangeGeometry, jointMaterial);
    flangeMesh.rotation.z = Math.PI / 2;
    flangeMesh.castShadow = true;
    joint6Pivot.add(flangeMesh);

    const tipMarker = new THREE.SphereGeometry(0.03, 16, 16);
    const tipMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const tipMarkerMesh = new THREE.Mesh(tipMarker, tipMaterial);
    tipMarkerMesh.position.set(0.06, 0, 0);
    joint6Pivot.add(tipMarkerMesh);

    this.links.push({
      mesh: joint6Pivot,
      length: 0.1,
      rotationAxis: 'y',
      offset: new THREE.Vector3(0.05, 0, 0)
    });
  }

  setJointAngles(jointState: JointState): void {
    const angles = [
      jointState.joint1,
      jointState.joint2,
      jointState.joint3,
      jointState.joint4,
      jointState.joint5,
      jointState.joint6
    ];

    angles.forEach((angle, index) => {
      const link = this.links[index];
      if (link) {
        const rad = THREE.MathUtils.degToRad(angle);
        link.mesh.rotation.set(0, 0, 0);
        switch (link.rotationAxis) {
          case 'x':
            link.mesh.rotation.x = rad;
            break;
          case 'y':
            link.mesh.rotation.y = rad;
            break;
          case 'z':
            link.mesh.rotation.z = rad;
            break;
        }
      }
      this.jointAngles[index] = angle;
    });
  }

  getJointAngles(): JointState {
    return {
      joint1: this.jointAngles[0],
      joint2: this.jointAngles[1],
      joint3: this.jointAngles[2],
      joint4: this.jointAngles[3],
      joint5: this.jointAngles[4],
      joint6: this.jointAngles[5]
    };
  }

  getEndEffectorPosition(): THREE.Vector3 {
    const tipMarker = this.findTipMarker();
    if (tipMarker) {
      const worldPos = new THREE.Vector3();
      tipMarker.getWorldPosition(worldPos);
      return worldPos;
    }
    return new THREE.Vector3();
  }

  private findTipMarker(): THREE.Mesh | null {
    let result: THREE.Mesh | null = null;
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.material instanceof THREE.MeshBasicMaterial) {
          result = child;
        }
      }
    });
    return result;
  }

  getEndEffectorPose(): Pose {
    const pos = this.getEndEffectorPosition();
    const lastLink = this.links[this.links.length - 1];
    const worldRotation = new THREE.Euler();
    
    if (lastLink) {
      const worldQuat = new THREE.Quaternion();
      lastLink.mesh.getWorldQuaternion(worldQuat);
      worldRotation.setFromQuaternion(worldQuat);
    }

    return {
      position: {
        x: Number(pos.x.toFixed(4)),
        y: Number(pos.y.toFixed(4)),
        z: Number(pos.z.toFixed(4))
      },
      orientation: {
        x: Number(THREE.MathUtils.radToDeg(worldRotation.x).toFixed(2)),
        y: Number(THREE.MathUtils.radToDeg(worldRotation.y).toFixed(2)),
        z: Number(THREE.MathUtils.radToDeg(worldRotation.z).toFixed(2))
      }
    };
  }

  getBoundingBoxes(): THREE.Box3[] {
    const boxes: THREE.Box3[] = [];
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const box = new THREE.Box3().setFromObject(child);
        if (box.min.x !== Infinity) {
          boxes.push(box);
        }
      }
    });
    return boxes;
  }

  getMesh(): THREE.Group {
    return this.group;
  }

  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  setHighlighted(highlighted: boolean): void {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (material && material.emissive) {
          material.emissive.setHex(highlighted ? 0xff4444 : 0x000000);
          material.emissiveIntensity = highlighted ? 0.5 : 0;
        }
      }
    });
  }
}
