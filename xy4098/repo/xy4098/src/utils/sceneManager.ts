import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Floor, Sensor, Thresholds } from '../types';

interface SceneObjects {
  floors: Map<string, {
    mesh: THREE.Mesh;
    zones: Map<string, THREE.Mesh>;
    sensors: Map<string, { mesh: THREE.Mesh; glow: THREE.Mesh }>;
  }>;
}

const FLOOR_HEIGHT = 1.5;
const FLOOR_OFFSET = 3;
const SCALE_FACTOR = 0.05;

export class SceneManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private objects: SceneObjects;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private container: HTMLElement;
  private hoveredObject: THREE.Object3D | null = null;
  private animationId: number | null = null;
  private sensorTemperatures: Map<string, number> = new Map();
  private sensorStatuses: Map<string, { isOnline: boolean; hasAlert: boolean }> = new Map();
  private thresholds: Thresholds;
  private clock: THREE.Clock;

  public onSensorClick: ((sensorId: string) => void) | null = null;
  public onFloorClick: ((floorId: string) => void) | null = null;
  public onZoneClick: ((zoneId: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.objects = {
      floors: new Map(),
    };
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.thresholds = {
      temperatureMin: 18,
      temperatureMax: 26,
      humidityMin: 30,
      humidityMax: 70,
    };
    this.clock = new THREE.Clock();

    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 15, 20);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 50;

    this.setupLights();
    this.setupEventListeners();
    this.animate();
  }

  private setupLights(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x2c3e50, 0.4);
    this.scene.add(hemisphereLight);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', () => this.onResize());
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
  }

  private onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private onMouseMove(event: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onClick(event: MouseEvent): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    const allObjects: THREE.Object3D[] = [];
    this.objects.floors.forEach((floorObj) => {
      allObjects.push(floorObj.mesh);
      floorObj.zones.forEach((zone) => allObjects.push(zone));
      floorObj.sensors.forEach((sensor) => {
        allObjects.push(sensor.mesh);
        allObjects.push(sensor.glow);
      });
    });

    const intersects = this.raycaster.intersectObjects(allObjects);

    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      
      this.objects.floors.forEach((floorObj, floorId) => {
        floorObj.sensors.forEach((sensor, sensorId) => {
          if (sensor.mesh === clickedObject || sensor.glow === clickedObject) {
            this.onSensorClick?.(sensorId);
            return;
          }
        });

        floorObj.zones.forEach((zone, zoneId) => {
          if (zone === clickedObject) {
            this.onZoneClick?.(zoneId);
            return;
          }
        });

        if (floorObj.mesh === clickedObject) {
          this.onFloorClick?.(floorId);
          return;
        }
      });
    }
  }

  private getTemperatureColor(temp: number): THREE.Color {
    const minTemp = this.thresholds.temperatureMin - 5;
    const maxTemp = this.thresholds.temperatureMax + 10;
    const normalized = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));
    
    let r, g, b;
    if (normalized < 0.33) {
      const t = normalized / 0.33;
      r = 0;
      g = 0.5 + t * 0.5;
      b = 1;
    } else if (normalized < 0.66) {
      const t = (normalized - 0.33) / 0.33;
      r = t;
      g = 1;
      b = 1 - t;
    } else {
      const t = (normalized - 0.66) / 0.34;
      r = 1;
      g = 1 - t;
      b = 0;
    }

    return new THREE.Color(r, g, b);
  }

  public setThresholds(thresholds: Thresholds): void {
    this.thresholds = thresholds;
    this.updateSensorColors();
  }

  public updateSensorTemperature(sensorId: string, temperature: number, isOnline: boolean, hasAlert: boolean): void {
    this.sensorTemperatures.set(sensorId, temperature);
    this.sensorStatuses.set(sensorId, { isOnline, hasAlert });
    this.updateSingleSensorColor(sensorId);
  }

  private updateSingleSensorColor(sensorId: string): void {
    this.objects.floors.forEach((floorObj) => {
      const sensorObj = floorObj.sensors.get(sensorId);
      if (sensorObj) {
        const temp = this.sensorTemperatures.get(sensorId);
        const status = this.sensorStatuses.get(sensorId);
        
        const material = sensorObj.mesh.material as THREE.MeshStandardMaterial;
        const glowMaterial = sensorObj.glow.material as THREE.MeshBasicMaterial;

        if (!status?.isOnline) {
          material.color.set(0x666666);
          material.emissive.set(0x333333);
          glowMaterial.color.set(0x444444);
        } else if (temp !== undefined) {
          const color = this.getTemperatureColor(temp);
          material.color.copy(color);
          material.emissive.copy(color).multiplyScalar(0.3);
          
          if (status?.hasAlert) {
            material.emissive.set(0xff0000).multiplyScalar(0.5);
            glowMaterial.color.set(0xff4444);
          } else {
            glowMaterial.color.copy(color);
          }
        }
      }
    });
  }

  private updateSensorColors(): void {
    this.sensorTemperatures.forEach((_, sensorId) => {
      this.updateSingleSensorColor(sensorId);
    });
  }

  public loadFloors(floors: Floor[]): void {
    this.objects.floors.forEach((floorObj) => {
      this.scene.remove(floorObj.mesh);
      floorObj.zones.forEach((zone) => this.scene.remove(zone));
      floorObj.sensors.forEach((sensor) => {
        this.scene.remove(sensor.mesh);
        this.scene.remove(sensor.glow);
      });
    });
    this.objects.floors.clear();

    const maxLevel = Math.max(...floors.map((f) => f.level));

    floors.forEach((floor) => {
      const floorY = (floor.level - maxLevel) * FLOOR_OFFSET;
      
      const floorGeometry = new THREE.BoxGeometry(6, FLOOR_HEIGHT, 4);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x3a5a40,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      });
      const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
      floorMesh.position.set(0, floorY + FLOOR_HEIGHT / 2, 0);
      floorMesh.userData = { type: 'floor', floorId: floor.id };
      this.scene.add(floorMesh);

      const edgeGeometry = new THREE.EdgesGeometry(floorGeometry);
      const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x588157, linewidth: 2 });
      const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
      edges.position.copy(floorMesh.position);
      this.scene.add(edges);

      const floorObj = {
        mesh: floorMesh,
        zones: new Map<string, THREE.Mesh>(),
        sensors: new Map<string, { mesh: THREE.Mesh; glow: THREE.Mesh }>(),
      };

      floor.zones.forEach((zone) => {
        if (zone.points.length < 3) return;

        const shape = new THREE.Shape();
        const firstPoint = zone.points[0];
        shape.moveTo(
          (firstPoint.x - 50) * SCALE_FACTOR,
          (firstPoint.y - 30) * SCALE_FACTOR
        );

        for (let i = 1; i < zone.points.length; i++) {
          const point = zone.points[i];
          shape.lineTo(
            (point.x - 50) * SCALE_FACTOR,
            (point.y - 30) * SCALE_FACTOR
          );
        }
        shape.closePath();

        const zoneGeometry = new THREE.ExtrudeGeometry(shape, {
          depth: 0.2,
          bevelEnabled: false,
        });
        
        const zoneMaterial = new THREE.MeshStandardMaterial({
          color: 0x4a7c59,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
        });
        
        const zoneMesh = new THREE.Mesh(zoneGeometry, zoneMaterial);
        zoneMesh.rotation.x = -Math.PI / 2;
        zoneMesh.position.set(0, floorY + FLOOR_HEIGHT + 0.01, 0);
        zoneMesh.userData = { type: 'zone', zoneId: zone.id, floorId: floor.id };
        this.scene.add(zoneMesh);

        const zoneEdgeGeometry = new THREE.EdgesGeometry(zoneGeometry);
        const zoneEdgeMaterial = new THREE.LineBasicMaterial({ color: 0x2d5a27 });
        const zoneEdges = new THREE.LineSegments(zoneEdgeGeometry, zoneEdgeMaterial);
        zoneEdges.rotation.copy(zoneMesh.rotation);
        zoneEdges.position.copy(zoneMesh.position);
        this.scene.add(zoneEdges);

        floorObj.zones.set(zone.id, zoneMesh);
      });

      this.objects.floors.set(floor.id, floorObj);
    });
  }

  public loadSensors(sensors: Sensor[]): void {
    this.objects.floors.forEach((floorObj) => {
      floorObj.sensors.forEach((sensor) => {
        this.scene.remove(sensor.mesh);
        this.scene.remove(sensor.glow);
      });
      floorObj.sensors.clear();
    });

    const maxLevel = Math.max(...Array.from(this.objects.floors.keys()).map((id) => {
      const floors = Array.from(this.objects.floors.entries());
      const floorEntry = floors.find(([floorId]) => floorId === id);
      return floorEntry ? 1 : 0;
    }));

    const floorLevels = new Map<string, number>();
    this.objects.floors.forEach((_, floorId) => {
      const floors = Array.from(this.objects.floors.entries());
      const level = floors.findIndex(([id]) => id === floorId) + 1;
      floorLevels.set(floorId, level);
    });
    const actualMaxLevel = floorLevels.size > 0 ? Math.max(...floorLevels.values()) : 1;

    sensors.forEach((sensor) => {
      const floorObj = this.objects.floors.get(sensor.floorId);
      if (!floorObj) return;

      const level = floorLevels.get(sensor.floorId) || 1;
      const floorY = (level - actualMaxLevel) * FLOOR_OFFSET;

      const sensorGeometry = new THREE.SphereGeometry(0.15, 16, 16);
      const sensorMaterial = new THREE.MeshStandardMaterial({
        color: 0x00aaff,
        emissive: 0x004466,
        emissiveIntensity: 0.5,
        metalness: 0.5,
        roughness: 0.3,
      });
      const sensorMesh = new THREE.Mesh(sensorGeometry, sensorMaterial);
      sensorMesh.position.set(
        (sensor.x - 50) * SCALE_FACTOR,
        floorY + FLOOR_HEIGHT + 0.35,
        (sensor.y - 30) * SCALE_FACTOR
      );
      sensorMesh.userData = { type: 'sensor', sensorId: sensor.id };
      this.scene.add(sensorMesh);

      const glowGeometry = new THREE.SphereGeometry(0.25, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.3,
      });
      const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.position.copy(sensorMesh.position);
      glowMesh.userData = { type: 'sensor', sensorId: sensor.id };
      this.scene.add(glowMesh);

      floorObj.sensors.set(sensor.id, { mesh: sensorMesh, glow: glowMesh });

      if (sensor.readings.length > 0) {
        const lastReading = sensor.readings[sensor.readings.length - 1];
        this.updateSensorTemperature(
          sensor.id,
          lastReading.temperature,
          lastReading.isOnline,
          false
        );
      }
    });
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(() => this.animate());
    
    const delta = this.clock.getDelta();
    
    this.objects.floors.forEach((floorObj) => {
      floorObj.sensors.forEach((sensor) => {
        const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
        sensor.glow.scale.set(scale, scale, scale);
        
        const temp = this.sensorTemperatures.get(sensor.glow.userData.sensorId);
        const status = this.sensorStatuses.get(sensor.glow.userData.sensorId);
        
        if (status?.hasAlert) {
          const glowMat = sensor.glow.material as THREE.MeshBasicMaterial;
          glowMat.opacity = 0.2 + Math.sin(Date.now() * 0.008) * 0.3;
        }
      });
    });

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const allSensorObjects: THREE.Object3D[] = [];
    this.objects.floors.forEach((floorObj) => {
      floorObj.sensors.forEach((sensor) => {
        allSensorObjects.push(sensor.mesh);
        allSensorObjects.push(sensor.glow);
      });
    });

    const intersects = this.raycaster.intersectObjects(allSensorObjects);
    
    if (this.hoveredObject) {
      const mesh = this.hoveredObject as THREE.Mesh;
      if (mesh.material && Array.isArray(mesh.material) === false) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 0.5;
        }
      }
      this.hoveredObject = null;
    }

    if (intersects.length > 0) {
      this.hoveredObject = intersects[0].object;
      const mesh = this.hoveredObject as THREE.Mesh;
      if (mesh.material && Array.isArray(mesh.material) === false) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.emissiveIntensity !== undefined) {
          mat.emissiveIntensity = 1;
        }
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  public setCameraRotation(rotation: number, elevation: number): void {
    const radius = 25;
    const theta = (rotation * Math.PI) / 180;
    const phi = (elevation * Math.PI) / 180;
    
    this.camera.position.x = radius * Math.sin(theta) * Math.cos(phi);
    this.camera.position.y = radius * Math.sin(phi) + 5;
    this.camera.position.z = radius * Math.cos(theta) * Math.cos(phi);
    this.camera.lookAt(0, 5, 0);
    this.controls.target.set(0, 5, 0);
  }

  public focusOnFloor(floorId: string): void {
    const floorObj = this.objects.floors.get(floorId);
    if (!floorObj) return;

    const floorY = floorObj.mesh.position.y;
    this.camera.position.set(0, floorY + 8, 10);
    this.camera.lookAt(0, floorY + 2, 0);
    this.controls.target.set(0, floorY + 2, 0);
  }

  public focusOnSensor(sensorId: string): void {
    this.objects.floors.forEach((floorObj) => {
      const sensor = floorObj.sensors.get(sensorId);
      if (sensor) {
        const pos = sensor.mesh.position.clone();
        this.camera.position.set(pos.x + 3, pos.y + 3, pos.z + 3);
        this.camera.lookAt(pos);
        this.controls.target.copy(pos);
      }
    });
  }

  public dispose(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    
    window.removeEventListener('resize', () => this.onResize());
    this.renderer.domElement.removeEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.removeEventListener('click', (e) => this.onClick(e));
    
    this.controls.dispose();
    this.renderer.dispose();
    
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
