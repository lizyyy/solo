import { ZONE_TARGETS } from './models.js';

const ZONE_COLORS = {
  A: 0x4a9eff,
  B: 0x7ec8e3,
  C: 0xa8d8ea
};

const ZONE_POSITIONS = {
  A: { x: -4, z: -3 },
  B: { x: 4, z: -3 },
  C: { x: 0, z: 3 }
};

class SimpleOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.target = new THREE.Vector3(0, 0, 0);
    this.distance = 16;
    this.minDistance = 8;
    this.maxDistance = 35;
    this.azimuth = Math.PI / 4;
    this.polar = Math.PI / 3.5;
    this.minPolar = 0.2;
    this.maxPolar = Math.PI / 2 + 0.1;
    this.rotateSpeed = 0.005;
    this.zoomSpeed = 0.1;
    this.dampingFactor = 0.1;

    this._azimuthVel = 0;
    this._polarVel = 0;
    this._zoomVel = 0;

    this._isDragging = false;
    this._lastX = 0;
    this._lastY = 0;

    this._bindEvents();
    this._updateCamera();
  }

  _bindEvents() {
    this.dom.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastX;
      const dy = e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      this._azimuthVel = -dx * this.rotateSpeed;
      this._polarVel = -dy * this.rotateSpeed;
    });

    window.addEventListener('mouseup', () => {
      this._isDragging = false;
    });

    this.dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._zoomVel = -e.deltaY * 0.001 * this.zoomSpeed;
    }, { passive: false });

    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  update() {
    this.azimuth += this._azimuthVel;
    this.polar += this._polarVel;
    this.distance += this._zoomVel;

    this._azimuthVel *= (1 - this.dampingFactor);
    this._polarVel *= (1 - this.dampingFactor);
    this._zoomVel *= (1 - this.dampingFactor);

    this.polar = Math.max(this.minPolar, Math.min(this.maxPolar, this.polar));
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));

    this._updateCamera();
  }

  _updateCamera() {
    const sinPolar = Math.sin(this.polar);
    this.camera.position.x = this.target.x + this.distance * sinPolar * Math.cos(this.azimuth);
    this.camera.position.y = this.target.y + this.distance * Math.cos(this.polar);
    this.camera.position.z = this.target.z + this.distance * sinPolar * Math.sin(this.azimuth);
    this.camera.lookAt(this.target);
  }
}

export class Scene3D {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.state = state;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.zoneMeshes = {};
    this.evaporatorMeshes = {};
    this.palletMeshes = [];
    this.animId = null;
    this.clock = new THREE.Clock();
    this._init();
  }

  _init() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0e14);
    this.scene.fog = new THREE.Fog(0x0a0e14, 15, 40);

    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;

    this.controls = new SimpleOrbitControls(this.camera, this.renderer.domElement);

    this._addLights();
    this._buildWarehouse();
    this._buildZones();
    this._buildEvaporators();
    this._buildPallets();

    window.addEventListener('resize', () => this._onResize());
    this._animate();
  }

  _addLights() {
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    this.scene.add(dirLight);

    const coolLightA = new THREE.PointLight(0x4a9eff, 0.5, 10);
    coolLightA.position.set(-4, 3, -3);
    this.scene.add(coolLightA);

    const coolLightB = new THREE.PointLight(0x7ec8e3, 0.5, 10);
    coolLightB.position.set(4, 3, -3);
    this.scene.add(coolLightB);

    const coolLightC = new THREE.PointLight(0xa8d8ea, 0.5, 10);
    coolLightC.position.set(0, 3, 3);
    this.scene.add(coolLightC);
  }

  _buildWarehouse() {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x1a2332,
      metalness: 0.3,
      roughness: 0.7,
      transparent: true,
      opacity: 0.3
    });

    const floorGroup = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(14, 0.2, 10);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x2a3040,
      metalness: 0.2,
      roughness: 0.8
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = -0.1;
    base.receiveShadow = true;
    floorGroup.add(base);

    const gridHelper = new THREE.GridHelper(14, 14, 0x3a4050, 0x2a3040);
    gridHelper.position.y = 0.01;
    floorGroup.add(gridHelper);

    this.scene.add(floorGroup);

    const wallGeo = new THREE.BoxGeometry(14, 5, 0.2);
    const wall1 = new THREE.Mesh(wallGeo, wallMat);
    wall1.position.set(0, 2.5, -5);
    this.scene.add(wall1);

    const wall2 = new THREE.Mesh(wallGeo, wallMat);
    wall2.position.set(0, 2.5, 5);
    this.scene.add(wall2);

    const wallSideGeo = new THREE.BoxGeometry(0.2, 5, 10);
    const wall3 = new THREE.Mesh(wallSideGeo, wallMat);
    wall3.position.set(-7, 2.5, 0);
    this.scene.add(wall3);

    const wall4 = new THREE.Mesh(wallSideGeo, wallMat);
    wall4.position.set(7, 2.5, 0);
    this.scene.add(wall4);
  }

  _buildZones() {
    for (const [zoneId, pos] of Object.entries(ZONE_POSITIONS)) {
      const zoneGeo = new THREE.BoxGeometry(5, 0.05, 4);
      const zoneMat = new THREE.MeshStandardMaterial({
        color: ZONE_COLORS[zoneId],
        transparent: true,
        opacity: 0.25,
        emissive: ZONE_COLORS[zoneId],
        emissiveIntensity: 0.1
      });
      const zone = new THREE.Mesh(zoneGeo, zoneMat);
      zone.position.set(pos.x, 0.03, pos.z);
      zone.receiveShadow = true;
      this.scene.add(zone);
      this.zoneMeshes[zoneId] = zone;

      const borderGeo = new THREE.EdgesGeometry(zoneGeo);
      const borderMat = new THREE.LineBasicMaterial({
        color: ZONE_COLORS[zoneId],
        linewidth: 2
      });
      const border = new THREE.LineSegments(borderGeo, borderMat);
      border.position.copy(zone.position);
      this.scene.add(border);
    }
  }

  _buildEvaporators() {
    for (const [zoneId, pos] of Object.entries(ZONE_POSITIONS)) {
      const evapGroup = new THREE.Group();

      const evapBodyGeo = new THREE.BoxGeometry(1.2, 0.4, 0.8);
      const evapMat = new THREE.MeshStandardMaterial({
        color: 0x606080,
        metalness: 0.6,
        roughness: 0.3
      });
      const evapBody = new THREE.Mesh(evapBodyGeo, evapMat);
      evapBody.castShadow = true;
      evapGroup.add(evapBody);

      const coilGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
      const coilMat = new THREE.MeshStandardMaterial({
        color: 0x8090a0,
        metalness: 0.8,
        roughness: 0.2
      });
      for (let i = 0; i < 3; i++) {
        const coil = new THREE.Mesh(coilGeo, coilMat);
        coil.rotation.x = Math.PI / 2;
        coil.position.set(-0.4 + i * 0.4, -0.25, 0);
        evapGroup.add(coil);
      }

      const pipeGeo = new THREE.CylinderGeometry(0.03, 0.03, 2, 6);
      const pipeMat = new THREE.MeshStandardMaterial({
        color: 0x505060,
        metalness: 0.7,
        roughness: 0.3
      });
      const pipe = new THREE.Mesh(pipeGeo, pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(0, 0.35, 0);
      evapGroup.add(pipe);

      evapGroup.position.set(pos.x, 3, pos.z);
      this.scene.add(evapGroup);
      this.evaporatorMeshes[zoneId] = evapGroup;
    }
  }

  _buildPallets() {
    const palletMat = new THREE.MeshStandardMaterial({
      color: 0x8b7355,
      roughness: 0.9
    });

    const zones = Object.keys(ZONE_POSITIONS);
    for (const zoneId of zones) {
      const pos = ZONE_POSITIONS[zoneId];
      const count = 3 + Math.floor(Math.random() * 3);

      for (let i = 0; i < count; i++) {
        const palletGroup = new THREE.Group();

        const baseGeo = new THREE.BoxGeometry(0.8, 0.15, 0.8);
        const base = new THREE.Mesh(baseGeo, palletMat);
        base.position.y = 0.075;
        base.castShadow = true;
        palletGroup.add(base);

        const boxColor = this._getBoxColor(zoneId);
        const boxMat = new THREE.MeshStandardMaterial({
          color: boxColor,
          roughness: 0.6
        });

        for (let j = 0; j < 3; j++) {
          const boxGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
          const box = new THREE.Mesh(boxGeo, boxMat);
          box.position.y = 0.15 + 0.2 + j * 0.4;
          box.castShadow = true;
          palletGroup.add(box);
        }

        const angle = (i / count) * Math.PI * 2;
        const radius = 1.5;
        palletGroup.position.set(
          pos.x + Math.cos(angle) * radius,
          0,
          pos.z + Math.sin(angle) * radius
        );
        this.scene.add(palletGroup);
        this.palletMeshes.push({ group: palletGroup, zoneId });
      }
    }
  }

  _getBoxColor(zoneId) {
    const colors = {
      A: 0xccddee,
      B: 0xddeeff,
      C: 0xeeddcc
    };
    return colors[zoneId] || 0xcccccc;
  }

  _onResize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  update() {
    if (!this.state) return;

    for (const zoneId of Object.keys(this.state.zones)) {
      const zone = this.state.zones[zoneId];
      const mesh = this.zoneMeshes[zoneId];
      if (!mesh) continue;

      const tempRange = zone.target.max - zone.target.min + 10;
      const tempRatio = Math.max(0, Math.min(1,
        (zone.temp - zone.target.min) / tempRange
      ));

      const coldColor = new THREE.Color(ZONE_COLORS[zoneId]);
      const warmColor = new THREE.Color(0xff6644);
      const currentColor = coldColor.clone().lerp(warmColor, tempRatio * 0.5);

      if (mesh.material) {
        mesh.material.color.copy(currentColor);
        mesh.material.emissive.copy(currentColor);
        mesh.material.emissiveIntensity = 0.1 + tempRatio * 0.2;
      }
    }

    for (const evapId of Object.keys(this.state.evaporators)) {
      const evap = this.state.evaporators[evapId];
      const group = this.evaporatorMeshes[evap.zone];
      if (!group) continue;

      group.children.forEach((child, idx) => {
        if (idx >= 1 && idx <= 3) {
          child.material.color.setHex(
            evap.isDefrosting(this.state.gameTime) ? 0xff8844 : 0x8090a0
          );
        }
      });
    }

    const t = this.clock.getElapsedTime();
    for (const pallet of this.palletMeshes) {
      const zone = this.state.zones[pallet.zoneId];
      if (zone && zone.doorOpen) {
        pallet.group.position.y = Math.sin(t * 2) * 0.03;
      } else {
        pallet.group.position.y *= 0.9;
      }
    }
  }

  _animate() {
    this.animId = requestAnimationFrame(() => this._animate());
    this.update();
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.renderer?.dispose();
  }
}