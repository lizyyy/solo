/**
 * 3D渲染模块
 * 使用Three.js渲染风机叶片、航线和缺陷点
 * 处理跨叶片坐标换算
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

class ThreeDRenderer {
  constructor(containerId, dataParser) {
    this.containerId = containerId;
    this.dataParser = dataParser;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    this.bladeMeshes = {};
    this.segmentMeshes = {};
    this.flightPathMeshes = [];
    this.defectMeshes = [];
    this.highlightedMesh = null;
    
    this.animationId = null;
    this.isInitialized = false;
  }

  /**
   * 初始化Three.js场景
   */
  init() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error('未找到容器元素:', this.containerId);
      return false;
    }

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.scene.fog = new THREE.Fog(0x1a1a2e, 100, 500);

    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    this.camera.position.set(100, 80, 100);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 30;
    this.controls.maxDistance = 300;
    this.controls.maxPolarAngle = Math.PI;

    this.addLights();
    this.addGroundPlane();

    window.addEventListener('resize', () => this.onWindowResize());

    this.isInitialized = true;
    this.animate();

    return true;
  }

  /**
   * 添加光源
   */
  addLights() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-50, 50, -50);
    this.scene.add(fillLight);
  }

  /**
   * 添加地面平面
   */
  addGroundPlane() {
    const groundGeometry = new THREE.PlaneGeometry(500, 500);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(500, 50, 0x444466, 0x333355);
    gridHelper.position.y = -4.9;
    this.scene.add(gridHelper);
  }

  /**
   * 渲染风机
   */
  renderTurbine() {
    if (!this.isInitialized) {
      console.error('渲染器未初始化');
      return;
    }

    const data = this.dataParser.getAllData();
    const turbine = data.turbine;

    if (!turbine) {
      console.error('风机数据未加载');
      return;
    }

    this.clearScene();
    this.renderTower(turbine);
    this.renderNacelle(turbine);
    this.renderHub(turbine);
    this.renderBlades(turbine);
  }

  /**
   * 渲染塔筒
   */
  renderTower(turbine) {
    const tower = turbine.tower;
    const hubHeight = turbine.hubHeight;

    const towerGeometry = new THREE.CylinderGeometry(
      tower.topDiameter / 2,
      tower.baseDiameter / 2,
      hubHeight,
      16
    );
    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0x888899,
      roughness: 0.7,
      metalness: 0.3
    });
    const towerMesh = new THREE.Mesh(towerGeometry, towerMaterial);
    towerMesh.position.y = hubHeight / 2;
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    this.scene.add(towerMesh);
  }

  /**
   * 渲染机舱
   */
  renderNacelle(turbine) {
    const nacelle = turbine.nacelle;
    const hubHeight = turbine.hubHeight;

    const nacelleGeometry = new THREE.BoxGeometry(nacelle.length, nacelle.height, nacelle.width);
    const nacelleMaterial = new THREE.MeshStandardMaterial({
      color: 0x666677,
      roughness: 0.6,
      metalness: 0.4
    });
    const nacelleMesh = new THREE.Mesh(nacelleGeometry, nacelleMaterial);
    nacelleMesh.position.y = hubHeight + nacelle.height / 2;
    nacelleMesh.castShadow = true;
    nacelleMesh.receiveShadow = true;
    this.scene.add(nacelleMesh);
  }

  /**
   * 渲染轮毂
   */
  renderHub(turbine) {
    const hubHeight = turbine.hubHeight;

    const hubGeometry = new THREE.SphereGeometry(3, 16, 16);
    const hubMaterial = new THREE.MeshStandardMaterial({
      color: 0x555566,
      roughness: 0.5,
      metalness: 0.5
    });
    const hubMesh = new THREE.Mesh(hubGeometry, hubMaterial);
    hubMesh.position.y = hubHeight + 5;
    hubMesh.castShadow = true;
    hubMesh.receiveShadow = true;
    this.scene.add(hubMesh);
  }

  /**
   * 渲染叶片
   * 处理跨叶片坐标换算
   */
  renderBlades(turbine) {
    const hubHeight = turbine.hubHeight;
    const colors = [0x4ecdc4, 0xff6b6b, 0xffd93d];

    for (let i = 0; i < turbine.blades.length; i++) {
      const blade = turbine.blades[i];
      const angle = (i * 2 * Math.PI) / 3;
      const color = colors[i];

      this.renderSingleBlade(blade, angle, color, hubHeight + 5, i);
    }
  }

  /**
   * 渲染单个叶片
   */
  renderSingleBlade(blade, rotationAngle, color, hubY, bladeIndex) {
    const bladeGroup = new THREE.Group();
    bladeGroup.name = `blade_${blade.bladeId}`;

    for (const segment of blade.segments) {
      const segmentMesh = this.createSegmentMesh(blade, segment, color);
      segmentMesh.userData = {
        bladeId: blade.bladeId,
        bladeName: blade.name,
        segmentId: segment.segmentId,
        segmentName: segment.name,
        segment: segment,
        bladeIndex: bladeIndex
      };
      this.segmentMeshes[segment.segmentId] = segmentMesh;
      bladeGroup.add(segmentMesh);
    }

    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationY(rotationAngle);
    bladeGroup.applyMatrix4(rotationMatrix);
    bladeGroup.position.y = hubY;

    this.bladeMeshes[blade.bladeId] = bladeGroup;
    this.scene.add(bladeGroup);
  }

  /**
   * 创建段网格
   */
  createSegmentMesh(blade, segment, baseColor) {
    const segmentLength = segment.end - segment.start;
    const startRatio = segment.start / blade.length;
    const endRatio = segment.end / blade.length;

    const startChord = blade.chordRoot * (1 - startRatio) + blade.chordTip * startRatio;
    const endChord = blade.chordRoot * (1 - endRatio) + blade.chordTip * endRatio;

    const shape = this.createBladeAirfoil(startChord);
    const extrudeSettings = {
      steps: 1,
      depth: segmentLength,
      bevelEnabled: false
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, segment.start, 0);

    const positionMap = {
      root: 0.3,
      middle: 0.5,
      tip: 0.7
    };
    const brightness = positionMap[segment.position] || 0.5;
    
    const color = new THREE.Color(baseColor);
    color.multiplyScalar(brightness);

    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.3,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    return mesh;
  }

  /**
   * 创建叶片翼型形状
   */
  createBladeAirfoil(chordLength) {
    const shape = new THREE.Shape();
    const halfChord = chordLength / 2;

    shape.moveTo(0, halfChord * 0.15);
    
    for (let t = 0; t <= 1; t += 0.1) {
      const x = t * halfChord;
      const y = this.naca4Digit(t, 0.15, 0.02, 0.4) * halfChord;
      shape.lineTo(x, y);
    }

    for (let t = 1; t >= 0; t -= 0.1) {
      const x = t * halfChord;
      const y = -this.naca4Digit(t, 0.15, 0.02, 0.4) * halfChord * 0.8;
      shape.lineTo(x, y);
    }

    shape.lineTo(0, -halfChord * 0.1);
    shape.closePath();

    return shape;
  }

  /**
   * NACA 4-digit翼型方程
   */
  naca4Digit(x, m, p, t) {
    if (x <= p) {
      return (m / (p * p)) * (2 * p * x - x * x);
    } else {
      return (m / ((1 - p) * (1 - p))) * ((1 - 2 * p) + 2 * p * x - x * x);
    }
  }

  /**
   * 渲染航线
   */
  renderFlightPath() {
    const data = this.dataParser.getAllData();
    const flightPath = data.flightPath;
    const turbine = data.turbine;

    if (!flightPath || !turbine) return;

    this.clearFlightPath();

    const hubHeight = turbine.hubHeight + 5;

    const bladeAngles = {
      'BL-001': 0,
      'BL-002': (2 * Math.PI) / 3,
      'BL-003': (4 * Math.PI) / 3
    };

    const pointsByBlade = {};
    for (const flight of flightPath) {
      if (!pointsByBlade[flight.bladeId]) {
        pointsByBlade[flight.bladeId] = [];
      }
      
      const localPoint = this.convertToBladeCoordinate(
        flight.position,
        flight.bladeId,
        bladeAngles[flight.bladeId] || 0,
        hubHeight,
        flight.coverageArea
      );
      
      pointsByBlade[flight.bladeId].push({
        point: localPoint,
        flight: flight
      });
    }

    for (const [bladeId, points] of Object.entries(pointsByBlade)) {
      if (points.length < 2) continue;

      const sortedPoints = points.sort((a, b) => 
        (a.flight.coverageArea?.start || 0) - (b.flight.coverageArea?.start || 0)
      );

      const geometry = new THREE.BufferGeometry();
      const vertices = [];
      const colors = [];

      for (const item of sortedPoints) {
        vertices.push(item.point.x, item.point.y, item.point.z);
        
        const windSpeed = item.flight.windSpeed || 0;
        let color;
        if (windSpeed > 6.0) {
          color = new THREE.Color(0xff0000);
        } else if (windSpeed > 5.0) {
          color = new THREE.Color(0xffaa00);
        } else {
          color = new THREE.Color(0x00ff88);
        }
        colors.push(color.r, color.g, color.b);
      }

      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        linewidth: 2,
        transparent: true,
        opacity: 0.8
      });

      const line = new THREE.Line(geometry, material);
      this.flightPathMeshes.push(line);
      this.scene.add(line);

      for (const item of sortedPoints) {
        const markerGeometry = new THREE.SphereGeometry(0.8, 8, 8);
        const windSpeed = item.flight.windSpeed || 0;
        let markerColor;
        if (windSpeed > 6.0) {
          markerColor = 0xff0000;
        } else if (windSpeed > 5.0) {
          markerColor = 0xffaa00;
        } else {
          markerColor = 0x00ff88;
        }
        const markerMaterial = new THREE.MeshBasicMaterial({ color: markerColor });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(item.point);
        marker.userData = { flight: item.flight, type: 'flightMarker' };
        this.flightPathMeshes.push(marker);
        this.scene.add(marker);
      }
    }
  }

  /**
   * 转换为叶片坐标系
   * 处理跨叶片坐标换算
   */
  convertToBladeCoordinate(position, bladeId, rotationAngle, hubY, coverageArea) {
    const distanceFromRoot = coverageArea ? (coverageArea.start + coverageArea.end) / 2 : 0;
    
    const radiusOffset = 20;
    const localY = hubY + distanceFromRoot;
    
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    
    const localX = (radiusOffset + 5) * cos;
    const localZ = (radiusOffset + 5) * sin;

    return new THREE.Vector3(localX, localY, localZ);
  }

  /**
   * 渲染缺陷点
   */
  renderDefects() {
    const data = this.dataParser.getAllData();
    const defects = data.defects;
    const turbine = data.turbine;

    if (!defects || !turbine) return;

    this.clearDefects();

    const hubHeight = turbine.hubHeight + 5;

    const bladeAngles = {
      'BL-001': 0,
      'BL-002': (2 * Math.PI) / 3,
      'BL-003': (4 * Math.PI) / 3
    };

    const severityColors = {
      high: 0xff0000,
      medium: 0xffaa00,
      low: 0x00ff00
    };

    const severitySizes = {
      high: 2.5,
      medium: 2.0,
      low: 1.5
    };

    for (const defect of defects) {
      const bladeAngle = bladeAngles[defect.bladeId] || 0;
      const position = this.getDefectPosition(
        defect,
        bladeAngle,
        hubHeight,
        turbine
      );

      const effectiveSeverity = defect.analysis?.effectiveSeverity || defect.severity;
      const color = severityColors[effectiveSeverity] || 0xffffff;
      const size = severitySizes[effectiveSeverity] || 1.5;

      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.userData = { defect: defect, type: 'defectMarker' };

      const ringGeometry = new THREE.RingGeometry(size * 1.2, size * 1.5, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(position);
      ring.lookAt(new THREE.Vector3(0, hubHeight, 0));
      ring.userData = { defect: defect, type: 'defectRing' };

      this.defectMeshes.push(mesh, ring);
      this.scene.add(mesh);
      this.scene.add(ring);
    }
  }

  /**
   * 获取缺陷在3D空间中的位置
   * 处理缺陷落在边界段的问题
   */
  getDefectPosition(defect, rotationAngle, hubY, turbine) {
    const blade = turbine.blades.find(b => b.bladeId === defect.bladeId);
    if (!blade) {
      return new THREE.Vector3(0, hubY, 0);
    }

    const distanceFromRoot = defect.distanceFromRoot;
    const epsilon = 0.5;

    let segment = null;
    for (const seg of blade.segments) {
      if (Math.abs(distanceFromRoot - seg.start) < epsilon || 
          Math.abs(distanceFromRoot - seg.end) < epsilon) {
        segment = seg;
        break;
      }
      if (distanceFromRoot >= seg.start && distanceFromRoot <= seg.end) {
        segment = seg;
        break;
      }
    }

    const ratio = distanceFromRoot / blade.length;
    const chord = blade.chordRoot * (1 - ratio) + blade.chordTip * ratio;

    const positionOffsets = {
      pressure_side: { x: 0, z: chord * 0.3 },
      suction_side: { x: 0, z: -chord * 0.3 },
      leading_edge: { x: chord * 0.4, z: 0 },
      trailing_edge: { x: -chord * 0.4, z: 0 }
    };

    const offset = positionOffsets[defect.position] || { x: 0, z: 0 };

    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);

    const localX = offset.x * cos - offset.z * sin;
    const localZ = offset.x * sin + offset.z * cos;

    return new THREE.Vector3(
      localX,
      hubY + distanceFromRoot,
      localZ
    );
  }

  /**
   * 高亮显示特定段
   */
  highlightSegment(segmentId) {
    if (this.highlightedMesh) {
      this.highlightedMesh.material.emissive.setHex(0x000000);
      this.highlightedMesh = null;
    }

    const mesh = this.segmentMeshes[segmentId];
    if (mesh) {
      mesh.material.emissive = new THREE.Color(0xffffff);
      mesh.material.emissiveIntensity = 0.3;
      this.highlightedMesh = mesh;

      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());

      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

      this.controls.target.copy(center);
      this.camera.position.lerp(
        new THREE.Vector3(
          center.x + cameraZ,
          center.y + cameraZ,
          center.z + cameraZ
        ),
        0.5
      );
      this.controls.update();
    }
  }

  /**
   * 清除航线
   */
  clearFlightPath() {
    for (const mesh of this.flightPathMeshes) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    this.flightPathMeshes = [];
  }

  /**
   * 清除缺陷
   */
  clearDefects() {
    for (const mesh of this.defectMeshes) {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    }
    this.defectMeshes = [];
  }

  /**
   * 清除场景中的风机相关对象
   */
  clearScene() {
    for (const bladeId in this.bladeMeshes) {
      this.scene.remove(this.bladeMeshes[bladeId]);
    }
    this.bladeMeshes = {};
    this.segmentMeshes = {};
    this.clearFlightPath();
    this.clearDefects();
  }

  /**
   * 窗口大小改变
   */
  onWindowResize() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  /**
   * 动画循环
   */
  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.clearScene();
    window.removeEventListener('resize', () => this.onWindowResize());
    
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  /**
   * 获取场景对象
   */
  getScene() {
    return this.scene;
  }

  /**
   * 获取相机
   */
  getCamera() {
    return this.camera;
  }

  /**
   * 获取渲染器
   */
  getRenderer() {
    return this.renderer;
  }
}

export default ThreeDRenderer;
