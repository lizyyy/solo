import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VOCAL_PARTS, MIC_TYPES } from './data.js';

const HEATMAP_RES = 128;
const STAGE_SIZE = 12;
const STAGE_HALF = STAGE_SIZE / 2;

class ChoirScene {
  constructor(canvas, onDataChange) {
    this.canvas = canvas;
    this.onDataChange = onDataChange;
    this.memberMeshes = new Map();
    this.micMeshes = new Map();
    this.memberLabels = new Map();
    this.micLabels = new Map();
    this.showHeatmap = true;
    this.showMics = true;
    this.showLabels = true;
    this.dragTarget = null;
    this.dragOffset = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.intersection = new THREE.Vector3();
    this.selectedId = null;

    this._initScene();
    this._initLights();
    this._initStage();
    this._initHeatmapPlane();
    this._initDragHandlers();
    this._animate();
  }

  _initScene() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(rect.width, rect.height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f1117);
    this.scene.fog = new THREE.Fog(0x0f1117, 20, 40);

    this.camera = new THREE.PerspectiveCamera(50, rect.width / rect.height, 0.1, 100);
    this.camera.position.set(8, 10, 12);
    this.camera.lookAt(0, 0, 0);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.1;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 30;

    this.labelGroup = new THREE.Group();
    this.scene.add(this.labelGroup);

    window.addEventListener('resize', () => this._onResize());
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0x404060, 1.5);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 2);
    dir.position.set(5, 10, 7);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.left = -10;
    dir.shadow.camera.right = 10;
    dir.shadow.camera.top = 10;
    dir.shadow.camera.bottom = -10;
    this.scene.add(dir);

    const point = new THREE.PointLight(0x6c8cff, 1, 20);
    point.position.set(0, 5, -6);
    this.scene.add(point);
  }

  _initStage() {
    const stageGeo = new THREE.BoxGeometry(STAGE_SIZE, 0.3, STAGE_SIZE);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x2a2d3a,
      roughness: 0.8,
      metalness: 0.1
    });
    this.stageMesh = new THREE.Mesh(stageGeo, stageMat);
    this.stageMesh.position.y = -0.15;
    this.stageMesh.receiveShadow = true;
    this.scene.add(this.stageMesh);

    const edgeGeo = new THREE.EdgesGeometry(stageGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x6c8cff, transparent: true, opacity: 0.3 });
    const edges = new THREE.LineSegments(edgeGeo, edgeMat);
    edges.position.copy(this.stageMesh.position);
    this.scene.add(edges);

    const gridHelper = new THREE.GridHelper(STAGE_SIZE, 24, 0x3d4060, 0x252836);
    gridHelper.position.y = 0.01;
    this.scene.add(gridHelper);

    const audienceDir = new THREE.Group();
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.6);
    arrowShape.lineTo(-0.3, 0.2);
    arrowShape.lineTo(-0.1, 0.2);
    arrowShape.lineTo(-0.1, -0.4);
    arrowShape.lineTo(0.1, -0.4);
    arrowShape.lineTo(0.1, 0.2);
    arrowShape.lineTo(0.3, 0.2);
    arrowShape.closePath();
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8b8fa3, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const arrow = new THREE.Mesh(arrowGeo, arrowMat);
    arrow.rotation.x = -Math.PI / 2;
    arrow.rotation.z = Math.PI;
    arrow.position.set(0, 0.02, STAGE_HALF - 0.8);
    arrow.scale.set(1.5, 1.5, 1.5);
    this.scene.add(arrow);

    this._addTextLabel('观众席', 0, 0.02, STAGE_HALF - 0.3, '#8b8fa3', 0.5);
  }

  _initHeatmapPlane() {
    this.heatmapCanvas = document.createElement('canvas');
    this.heatmapCanvas.width = HEATMAP_RES;
    this.heatmapCanvas.height = HEATMAP_RES;
    this.heatmapCtx = this.heatmapCanvas.getContext('2d');

    const texture = new THREE.CanvasTexture(this.heatmapCanvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

    const planeGeo = new THREE.PlaneGeometry(STAGE_SIZE, STAGE_SIZE);
    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.heatmapMesh = new THREE.Mesh(planeGeo, planeMat);
    this.heatmapMesh.rotation.x = -Math.PI / 2;
    this.heatmapMesh.position.y = 0.02;
    this.scene.add(this.heatmapMesh);
  }

  _addTextLabel(text, x, y, z, color, scale) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = color || '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set((scale || 1) * 2, (scale || 1) * 0.5, 1);
    this.labelGroup.add(sprite);
    return sprite;
  }

  _createMemberSprite(name, vocalPart) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    const color = VOCAL_PARTS[vocalPart]?.color || '#ffffff';
    ctx.fillStyle = color;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.4, 1);
    return sprite;
  }

  updateFormation(formation) {
    if (!formation) return;

    const currentMemberIds = new Set(formation.members.keys());
    for (const [id, mesh] of this.memberMeshes) {
      if (!currentMemberIds.has(id)) {
        this.scene.remove(mesh);
        if (this.memberLabels.has(id)) {
          this.labelGroup.remove(this.memberLabels.get(id));
          this.memberLabels.delete(id);
        }
        this.memberMeshes.delete(id);
      }
    }

    const currentMicIds = new Set(formation.microphones.keys());
    for (const [id, mesh] of this.micMeshes) {
      if (!currentMicIds.has(id)) {
        this.scene.remove(mesh);
        if (this.micLabels.has(id)) {
          this.labelGroup.remove(this.micLabels.get(id));
          this.micLabels.delete(id);
        }
        this.micMeshes.delete(id);
      }
    }

    for (const [id, member] of formation.members) {
      const color = VOCAL_PARTS[member.vocalPart]?.color || '#ffffff';
      if (!this.memberMeshes.has(id)) {
        const geo = new THREE.SphereGeometry(0.2, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(color),
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.3,
          roughness: 0.4,
          metalness: 0.1
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.userData = { type: 'member', id };
        this.scene.add(mesh);
        this.memberMeshes.set(id, mesh);

        const sprite = this._createMemberSprite(member.name, member.vocalPart);
        this.labelGroup.add(sprite);
        this.memberLabels.set(id, sprite);
      }

      const mesh = this.memberMeshes.get(id);
      mesh.position.set(member.position.x, 0.2, member.position.z);
      mesh.material.color.set(color);
      mesh.material.emissive.set(color);

      if (id === this.selectedId) {
        mesh.material.emissiveIntensity = 0.8;
      } else {
        mesh.material.emissiveIntensity = 0.3;
      }

      const sprite = this.memberLabels.get(id);
      if (sprite) {
        sprite.position.set(member.position.x, 0.7, member.position.z);
        sprite.visible = this.showLabels;
      }
    }

    for (const [id, mic] of formation.microphones) {
      if (!this.micMeshes.has(id)) {
        const group = new THREE.Group();
        group.userData = { type: 'mic', id };

        const bodyGeo = new THREE.CylinderGeometry(0.08, 0.15, 0.4, 12);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0xaaaaaa,
          metalness: 0.8,
          roughness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.35;
        body.castShadow = true;
        group.add(body);

        const standGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.35, 8);
        const standMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.3 });
        const stand = new THREE.Mesh(standGeo, standMat);
        stand.position.y = 0.175;
        group.add(stand);

        const dirLen = Math.sqrt(mic.direction.x ** 2 + mic.direction.z ** 2) || 1;
        const dirNorm = { x: mic.direction.x / dirLen, z: mic.direction.z / dirLen };
        const angle = Math.atan2(dirNorm.x, -dirNorm.z);

        const coneGeo = new THREE.ConeGeometry(0.8, 2, 16, 1, true);
        const coneMat = new THREE.MeshBasicMaterial({
          color: MIC_TYPES[mic.type]?.label === '心形' ? 0x6c8cff :
                 MIC_TYPES[mic.type]?.label === '8字形' ? 0xff7eb3 : 0x7eff8e,
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, 0.4, -1);
        cone.name = 'pickupCone';
        group.add(cone);

        group.rotation.y = angle;
        this.scene.add(group);
        this.micMeshes.set(id, group);

        const sprite = this._createMemberSprite(mic.name, 'soprano');
        sprite.material.color = new THREE.Color(0xaaaaee);
        this.labelGroup.add(sprite);
        this.micLabels.set(id, sprite);
      }

      const group = this.micMeshes.get(id);
      group.position.set(mic.position.x, 0, mic.position.z);

      const dirLen = Math.sqrt(mic.direction.x ** 2 + mic.direction.z ** 2) || 1;
      const dirNorm = { x: mic.direction.x / dirLen, z: mic.direction.z / dirLen };
      group.rotation.y = Math.atan2(dirNorm.x, -dirNorm.z);

      group.visible = this.showMics;

      const cone = group.getObjectByName('pickupCone');
      if (cone) {
        const micType = MIC_TYPES[mic.type] || MIC_TYPES.cardioid;
        const coneScale = micType.sensitivity;
        cone.scale.set(coneScale, coneScale * 1.2, coneScale);
      }

      const sprite = this.micLabels.get(id);
      if (sprite) {
        sprite.position.set(mic.position.x, 1.2, mic.position.z);
        sprite.visible = this.showLabels && this.showMics;
      }
    }

    this._updateHeatmap(formation);
  }

  _updateHeatmap(formation) {
    const ctx = this.heatmapCtx;
    const w = HEATMAP_RES;
    const h = HEATMAP_RES;
    ctx.clearRect(0, 0, w, h);

    const members = [...formation.members.values()];
    if (members.length === 0) {
      this.heatmapMesh.material.map.needsUpdate = true;
      return;
    }

    const imageData = ctx.createImageData(w, h);
    const data = imageData.data;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const worldX = (px / w - 0.5) * STAGE_SIZE;
        const worldZ = (py / h - 0.5) * STAGE_SIZE;
        let totalIntensity = 0;

        for (const member of members) {
          const dx = worldX - member.position.x;
          const dz = worldZ - member.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const sigma = 1.5;
          const intensity = Math.exp(-(dist * dist) / (2 * sigma * sigma));
          const partInfo = VOCAL_PARTS[member.vocalPart] || VOCAL_PARTS.soprano;
          totalIntensity += intensity * 0.5;
        }

        const mics = [...formation.microphones.values()];
        let micBoost = 0;
        for (const mic of mics) {
          const micType = MIC_TYPES[mic.type] || MIC_TYPES.cardioid;
          const dx = worldX - mic.position.x;
          const dz = worldZ - mic.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 6) continue;
          const baseIntensity = micType.sensitivity * Math.exp(-(dist * dist) / 8);
          const dirLen = Math.sqrt(mic.direction.x ** 2 + mic.direction.z ** 2) || 1;
          const dirNorm = { x: mic.direction.x / dirLen, z: mic.direction.z / dirLen };
          const toPoint = { x: worldX - mic.position.x, z: worldZ - mic.position.z };
          const toPointLen = Math.sqrt(toPoint.x ** 2 + toPoint.z ** 2) || 1;
          const dot = dirNorm.x * (toPoint.x / toPointLen) + dirNorm.z * (toPoint.z / toPointLen);
          const pickupFactor = mic.type === 'omni' ? 1 :
            mic.type === 'figure8' ? Math.abs(dot) * micType.backAttenuation :
            Math.max(0, dot) * (1 - micType.backAttenuation) + micType.backAttenuation * 0.1;
          micBoost += baseIntensity * pickupFactor;
        }

        const val = Math.min(1, totalIntensity + micBoost * 0.6);

        const idx = (py * w + px) * 4;
        if (val < 0.01) {
          data[idx] = 0;
          data[idx + 1] = 0;
          data[idx + 2] = 0;
          data[idx + 3] = 0;
        } else if (val < 0.25) {
          const t = val / 0.25;
          data[idx] = 0;
          data[idx + 1] = Math.floor(t * 100);
          data[idx + 2] = Math.floor(150 + t * 105);
          data[idx + 3] = Math.floor(t * 150);
        } else if (val < 0.5) {
          const t = (val - 0.25) / 0.25;
          data[idx] = 0;
          data[idx + 1] = Math.floor(100 + t * 155);
          data[idx + 2] = Math.floor(255 - t * 155);
          data[idx + 3] = 150;
        } else if (val < 0.75) {
          const t = (val - 0.5) / 0.25;
          data[idx] = Math.floor(t * 255);
          data[idx + 1] = 255;
          data[idx + 2] = Math.floor(100 - t * 100);
          data[idx + 3] = 180;
        } else {
          const t = (val - 0.75) / 0.25;
          data[idx] = 255;
          data[idx + 1] = Math.floor(255 - t * 155);
          data[idx + 2] = 0;
          data[idx + 3] = 200;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    this.heatmapMesh.material.map.needsUpdate = true;
    this.heatmapMesh.visible = this.showHeatmap;
  }

  _initDragHandlers() {
    let isDragging = false;

    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const allMeshes = [
        ...[...this.memberMeshes.values()],
        ...[...this.micMeshes.values()]
      ];
      const intersects = this.raycaster.intersectObjects(allMeshes, true);

      if (intersects.length > 0) {
        let hitObj = intersects[0].object;
        while (hitObj.parent && !hitObj.userData.type) {
          hitObj = hitObj.parent;
        }
        if (hitObj.userData.type) {
          this.dragTarget = hitObj;
          this.selectedId = hitObj.userData.id;
          isDragging = true;
          this.controls.enabled = false;

          if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
            this.dragOffset.copy(this.intersection).sub(
              new THREE.Vector3(hitObj.position.x, 0, hitObj.position.z)
            );
          }
          this._emitSelection();
        }
      } else {
        this.selectedId = null;
        this._emitSelection();
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      if (!isDragging || !this.dragTarget) return;

      const rect = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      if (this.raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
        const newX = Math.max(-STAGE_HALF + 0.3, Math.min(STAGE_HALF - 0.3, this.intersection.x - this.dragOffset.x));
        const newZ = Math.max(-STAGE_HALF + 0.3, Math.min(STAGE_HALF - 0.3, this.intersection.z - this.dragOffset.z));
        this.dragTarget.position.x = newX;
        this.dragTarget.position.z = newZ;

        const type = this.dragTarget.userData.type;
        const id = this.dragTarget.userData.id;
        const labelMap = type === 'member' ? this.memberLabels : this.micLabels;
        const label = labelMap.get(id);
        if (label) {
          label.position.x = newX;
          label.position.z = newZ;
        }

        if (this.onDataChange) {
          this.onDataChange(type, id, { x: newX, z: newZ }, true);
        }
      }
    });

    const endDrag = () => {
      if (isDragging && this.dragTarget) {
        isDragging = false;
        this.controls.enabled = true;
      }
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointerleave', endDrag);
  }

  _emitSelection() {
    if (this.onSelect) {
      this.onSelect(this.selectedId);
    }
  }

  toggleHeatmap(show) {
    this.showHeatmap = show;
    this.heatmapMesh.visible = show;
  }

  toggleMics(show) {
    this.showMics = show;
    for (const [, mesh] of this.micMeshes) {
      mesh.visible = show;
    }
    for (const [, sprite] of this.micLabels) {
      sprite.visible = show && this.showLabels;
    }
  }

  toggleLabels(show) {
    this.showLabels = show;
    for (const [, sprite] of this.memberLabels) {
      sprite.visible = show;
    }
    for (const [, sprite] of this.micLabels) {
      sprite.visible = show && this.showMics;
    }
  }

  resetCamera() {
    this.camera.position.set(8, 10, 12);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  _onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  _animate() {
    requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

export { ChoirScene };
