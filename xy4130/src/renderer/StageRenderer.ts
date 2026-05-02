import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  StageProject,
  Rig,
  LightFixture,
  Actor,
  RestrictedZone,
  Risk,
  Vector3,
} from '@/types';
import {
  interpolateKeyframes,
  interpolateSimpleKeyframes,
  degToRad,
} from '@/utils/math';

interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

interface SceneObjects {
  stage: THREE.Group;
  rigs: Map<string, THREE.Mesh>;
  lights: Map<string, THREE.Mesh>;
  lightBeams: Map<string, THREE.Mesh>;
  actors: Map<string, THREE.Group>;
  zones: Map<string, THREE.Mesh>;
  riskMarkers: Map<string, THREE.Mesh>;
  grid: THREE.GridHelper;
}

export class StageRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private objects: SceneObjects;
  private animationFrameId: number | null = null;
  private project: StageProject | null = null;
  private currentTime: number = 0;
  private onSelect: ((type: 'light' | 'rig' | 'actor', id: string) => void) | null = null;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  constructor(config: RendererConfig) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: config.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(config.width, config.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);

    this.camera = new THREE.PerspectiveCamera(
      60,
      config.width / config.height,
      0.1,
      1000
    );
    this.camera.position.set(20, 15, 20);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 100;
    this.controls.maxPolarAngle = Math.PI / 2;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.objects = {
      stage: new THREE.Group(),
      rigs: new Map(),
      lights: new Map(),
      lightBeams: new Map(),
      actors: new Map(),
      zones: new Map(),
      riskMarkers: new Map(),
      grid: new THREE.GridHelper(50, 50, 0x444444, 0x333333),
    };

    this.setupLighting();
    this.scene.add(this.objects.grid);
    this.scene.add(this.objects.stage);

    this.setupClickHandling();
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
  }

  private setupClickHandling(): void {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      const allMeshes: THREE.Mesh[] = [];
      this.objects.rigs.forEach((mesh) => allMeshes.push(mesh));
      this.objects.lights.forEach((mesh) => allMeshes.push(mesh));
      this.objects.actors.forEach((group) => {
        group.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            allMeshes.push(child);
          }
        });
      });

      const intersects = this.raycaster.intersectObjects(allMeshes);

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        const userData = clickedObject.userData;

        if (userData.objectType && userData.objectId) {
          this.onSelect?.(userData.objectType, userData.objectId);
        }
      }
    });
  }

  setOnSelect(callback: (type: 'light' | 'rig' | 'actor', id: string) => void): void {
    this.onSelect = callback;
  }

  setProject(project: StageProject): void {
    this.project = project;
    this.clearScene();
    this.buildScene();
    this.updateTime(this.currentTime);
  }

  private clearScene(): void {
    this.objects.rigs.forEach((mesh) => this.objects.stage.remove(mesh));
    this.objects.lights.forEach((mesh) => this.objects.stage.remove(mesh));
    this.objects.lightBeams.forEach((mesh) => this.objects.stage.remove(mesh));
    this.objects.actors.forEach((group) => this.objects.stage.remove(group));
    this.objects.zones.forEach((mesh) => this.objects.stage.remove(mesh));
    this.objects.riskMarkers.forEach((mesh) => this.objects.stage.remove(mesh));

    this.objects.rigs.clear();
    this.objects.lights.clear();
    this.objects.lightBeams.clear();
    this.objects.actors.clear();
    this.objects.zones.clear();
    this.objects.riskMarkers.clear();

    while (this.objects.stage.children.length > 0) {
      this.objects.stage.remove(this.objects.stage.children[0]);
    }
  }

  private buildScene(): void {
    if (!this.project) return;

    this.buildStageFloor();
    this.buildRigs();
    this.buildLights();
    this.buildActors();
    this.buildZones();
  }

  private buildStageFloor(): void {
    if (!this.project) return;

    const stage = this.project.stage;

    const floorGeometry = new THREE.PlaneGeometry(stage.width, stage.depth);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a3e,
      roughness: 0.8,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, stage.depth / 2);
    floor.receiveShadow = true;
    this.objects.stage.add(floor);

    const edgeGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(stage.width, 0.1, stage.depth)
    );
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x6666ff });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edges.position.set(0, 0.05, stage.depth / 2);
    this.objects.stage.add(edges);

    const prosceniumWidth = stage.prosceniumWidth;
    const prosceniumHeight = stage.prosceniumHeight;

    const leftArchGeo = new THREE.BoxGeometry(0.3, prosceniumHeight, 0.5);
    const archMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a4a5e,
      roughness: 0.7,
    });

    const leftArch = new THREE.Mesh(leftArchGeo, archMaterial);
    leftArch.position.set(-prosceniumWidth / 2, prosceniumHeight / 2, 0);
    this.objects.stage.add(leftArch);

    const rightArch = new THREE.Mesh(leftArchGeo, archMaterial);
    rightArch.position.set(prosceniumWidth / 2, prosceniumHeight / 2, 0);
    this.objects.stage.add(rightArch);

    const topArchGeo = new THREE.BoxGeometry(prosceniumWidth + 0.6, 0.3, 0.5);
    const topArch = new THREE.Mesh(topArchGeo, archMaterial);
    topArch.position.set(0, prosceniumHeight, 0);
    this.objects.stage.add(topArch);
  }

  private buildRigs(): void {
    if (!this.project) return;

    const rigMaterial = new THREE.MeshStandardMaterial({
      color: 0x666688,
      roughness: 0.6,
      metalness: 0.4,
    });

    this.project.rigs.forEach((rig) => {
      const geometry = new THREE.BoxGeometry(rig.length, 0.15, 0.15);
      const mesh = new THREE.Mesh(geometry, rigMaterial);
      mesh.userData = { objectType: 'rig' as const, objectId: rig.id };
      mesh.castShadow = true;
      this.objects.stage.add(mesh);
      this.objects.rigs.set(rig.id, mesh);
    });
  }

  private buildLights(): void {
    if (!this.project) return;

    const lightBodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x333344,
      roughness: 0.4,
      metalness: 0.6,
    });

    const lightFrontMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffee,
      emissive: 0x666644,
      emissiveIntensity: 0.5,
    });

    this.project.lights.forEach((light) => {
      const group = new THREE.Group();

      const bodyGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.4, 16);
      const body = new THREE.Mesh(bodyGeometry, lightBodyMaterial);
      body.rotation.x = Math.PI / 2;
      body.userData = { objectType: 'light' as const, objectId: light.id };
      group.add(body);

      const frontGeometry = new THREE.CircleGeometry(0.12, 16);
      const front = new THREE.Mesh(frontGeometry, lightFrontMaterial);
      front.position.z = 0.2;
      front.userData = { objectType: 'light' as const, objectId: light.id };
      group.add(front);

      const beamMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(light.color.r / 255, light.color.g / 255, light.color.b / 255),
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });

      const beamLength = 15;
      const beamAngleRad = degToRad(light.type.beamAngle / 2);
      const topRadius = Math.tan(beamAngleRad) * beamLength;

      const beamGeometry = new THREE.CylinderGeometry(0.1, topRadius, beamLength, 16, 1, true);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.z = beamLength / 2;
      beam.visible = false;
      this.objects.lightBeams.set(light.id, beam);
      group.add(beam);

      this.objects.stage.add(group);
      this.objects.lights.set(light.id, group);
    });
  }

  private buildActors(): void {
    if (!this.project) return;

    this.project.actors.forEach((actor) => {
      const group = new THREE.Group();

      const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0x4488ff,
        roughness: 0.7,
      });

      const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xffccaa,
        roughness: 0.6,
      });

      const headRadius = 0.2;
      const headGeometry = new THREE.SphereGeometry(headRadius, 16, 16);
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.y = actor.height - headRadius;
      head.castShadow = true;
      head.userData = { objectType: 'actor' as const, objectId: actor.id };
      group.add(head);

      const bodyHeight = actor.height - headRadius * 2;
      const bodyGeometry = new THREE.CylinderGeometry(actor.radius * 0.7, actor.radius, bodyHeight, 16);
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = bodyHeight / 2;
      body.castShadow = true;
      body.userData = { objectType: 'actor' as const, objectId: actor.id };
      group.add(body);

      this.objects.stage.add(group);
      this.objects.actors.set(actor.id, group);
    });
  }

  private buildZones(): void {
    if (!this.project) return;

    this.project.restrictedZones.forEach((zone) => {
      const material = new THREE.MeshBasicMaterial({
        color: zone.type === 'noEntry' ? 0xff4444 : 0xffaa00,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
      });

      const edgeMaterial = new THREE.LineBasicMaterial({
        color: zone.type === 'noEntry' ? 0xff4444 : 0xffaa00,
        transparent: true,
        opacity: 0.6,
        dashSize: 0.3,
        gapSize: 0.2,
      });

      const width = zone.bounds.max.x - zone.bounds.min.x;
      const height = zone.bounds.max.y - zone.bounds.min.y;
      const depth = zone.bounds.max.z - zone.bounds.min.z;

      const centerX = (zone.bounds.min.x + zone.bounds.max.x) / 2;
      const centerY = (zone.bounds.min.y + zone.bounds.max.y) / 2;
      const centerZ = (zone.bounds.min.z + zone.bounds.max.z) / 2;

      const geometry = new THREE.BoxGeometry(width, height, depth);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(centerX, centerY, centerZ);
      this.objects.stage.add(mesh);

      const edges = new THREE.EdgesGeometry(geometry);
      const lineSegments = new THREE.LineSegments(edges, edgeMaterial);
      lineSegments.position.set(centerX, centerY, centerZ);
      this.objects.stage.add(lineSegments);

      this.objects.zones.set(zone.id, mesh);
    });
  }

  updateTime(time: number): void {
    this.currentTime = time;
    if (!this.project) return;

    this.updateRigPositions();
    this.updateLightPositions();
    this.updateActorPositions();
  }

  private updateRigPositions(): void {
    if (!this.project) return;

    this.project.rigs.forEach((rig) => {
      const mesh = this.objects.rigs.get(rig.id);
      if (!mesh) return;

      const timeline = this.project!.rigTimelines.find((t) => t.rigId === rig.id);
      let height = rig.currentHeight;

      if (timeline && timeline.keyframes.length > 0) {
        height = interpolateSimpleKeyframes(timeline.keyframes, this.currentTime, 'height');
      }

      mesh.position.set(rig.position.x, height, rig.position.z);
    });
  }

  private updateLightPositions(): void {
    if (!this.project) return;

    this.project.lights.forEach((light) => {
      const group = this.objects.lights.get(light.id);
      if (!group) return;

      const rig = this.project!.rigs.find((r) => r.id === light.rigId);
      if (!rig) return;

      const timeline = this.project!.rigTimelines.find((t) => t.rigId === rig.id);
      let rigHeight = rig.currentHeight;
      if (timeline && timeline.keyframes.length > 0) {
        rigHeight = interpolateSimpleKeyframes(timeline.keyframes, this.currentTime, 'height');
      }

      const lightTimeline = this.project!.lightTimelines.find((t) => t.lightId === light.id);
      let pan = light.pan;
      let tilt = light.tilt;
      let intensity = light.intensity;

      if (lightTimeline && lightTimeline.keyframes.length > 0) {
        const kfs = lightTimeline.keyframes;
        const latestBeforeTime = kfs.filter((k) => k.time <= this.currentTime).pop();
        if (latestBeforeTime) {
          if (latestBeforeTime.pan !== undefined) pan = latestBeforeTime.pan;
          if (latestBeforeTime.tilt !== undefined) tilt = latestBeforeTime.tilt;
          if (latestBeforeTime.intensity !== undefined) intensity = latestBeforeTime.intensity;
        }
      }

      const lightX = rig.position.x + (light.positionOnRig / rig.length) * rig.length - rig.length / 2;

      group.position.set(lightX, rigHeight, rig.position.z);
      group.rotation.set(degToRad(tilt), 0, -degToRad(pan), 'ZXY');

      const beam = this.objects.lightBeams.get(light.id);
      if (beam) {
        beam.visible = intensity > 0.1;
      }
    });
  }

  private updateActorPositions(): void {
    if (!this.project) return;

    this.project.actors.forEach((actor) => {
      const group = this.objects.actors.get(actor.id);
      if (!group) return;

      const timeline = this.project!.actorTimelines.find((t) => t.actorId === actor.id);
      if (!timeline || timeline.keyframes.length === 0) return;

      const state = interpolateKeyframes(timeline.keyframes, this.currentTime);

      group.position.set(state.x, state.y, state.z);
      group.rotation.y = degToRad(state.rotation);
    });
  }

  updateRisks(risks: Risk[]): void {
    this.objects.riskMarkers.forEach((marker) => this.objects.stage.remove(marker));
    this.objects.riskMarkers.clear();

    risks.forEach((risk) => {
      const color =
        risk.level === 'critical'
          ? 0xff0000
          : risk.level === 'warning'
          ? 0xffaa00
          : 0x0088ff;

      const markerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      const markerMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
      });
      const marker = new THREE.Mesh(markerGeometry, markerMaterial);
      marker.position.set(risk.location.x, risk.location.y, risk.location.z);

      this.objects.stage.add(marker);
      this.objects.riskMarkers.set(risk.id, marker);
    });
  }

  setSelected(type: 'light' | 'rig' | 'actor' | null, id: string | null): void {
    this.objects.rigs.forEach((mesh, rigId) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissive =
        type === 'rig' && id === rigId
          ? new THREE.Color(0x00ff88)
          : new THREE.Color(0x000000);
      material.emissiveIntensity = type === 'rig' && id === rigId ? 0.5 : 0;
    });

    this.objects.lights.forEach((group, lightId) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.emissive !== undefined) {
            material.emissive =
              type === 'light' && id === lightId
                ? new THREE.Color(0x00ff88)
                : new THREE.Color(0x666644);
            material.emissiveIntensity = type === 'light' && id === lightId ? 0.8 : 0.5;
          }
        }
      });
    });

    this.objects.actors.forEach((group, actorId) => {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const material = child.material as THREE.MeshStandardMaterial;
          if (material.emissive !== undefined) {
            material.emissive =
              type === 'actor' && id === actorId
                ? new THREE.Color(0x00ff88)
                : new THREE.Color(0x000000);
            material.emissiveIntensity = type === 'actor' && id === actorId ? 0.5 : 0;
          }
        }
      });
    });
  }

  setSize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  start(): void {
    if (this.animationFrameId !== null) return;

    const animate = () => {
      this.animationFrameId = requestAnimationFrame(animate);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
    this.controls.dispose();
  }
}
