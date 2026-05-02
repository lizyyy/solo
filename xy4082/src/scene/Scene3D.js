/**
 * 3D 场景管理器
 * 负责 Three.js 渲染、交互（选择、拖拽）
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Scene3D {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    
    // 场景元素
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    
    // 射线投射（用于选择）
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    // 场景对象
    this.wallMesh = null;
    this.holdMeshes = new Map();  // holdId -> { mesh, data }
    this.routeLines = [];
    this.landingZoneMeshes = [];
    
    // 选择状态
    this.selectedHoldId = null;
    this.highlightedHoldId = null;
    
    // 拖拽状态
    this.isDragging = false;
    this.dragPlane = null;
    this.dragOffset = new THREE.Vector3();
    
    // 事件回调
    this._listeners = new Map();
    
    // 动画循环
    this._animationId = null;
    
    // 初始化
    this._init();
  }

  _init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    
    // 创建场景
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    // 创建相机
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(3, 2.5, 5);
    
    // 创建渲染器
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    // 创建控制器
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.minDistance = 1;
    this.controls.maxDistance = 20;
    this.controls.target.set(2, 1.5, 0);
    
    // 添加灯光
    this._setupLights();
    
    // 添加参考网格
    this._addGrid();
    
    // 添加坐标轴（可选，用于调试）
    if (this.options.showAxes) {
      const axesHelper = new THREE.AxesHelper(2);
      this.scene.add(axesHelper);
    }
    
    // 绑定事件
    this._bindEvents();
    
    // 开始动画循环
    this._animate();
  }

  _setupLights() {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);
    
    // 主方向光
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    this.scene.add(mainLight);
    
    // 补光
    const fillLight = new THREE.DirectionalLight(0x8888ff, 0.3);
    fillLight.position.set(-5, 5, -5);
    this.scene.add(fillLight);
  }

  _addGrid() {
    // 地面网格
    const gridHelper = new THREE.GridHelper(10, 20, 0x444444, 0x333333);
    gridHelper.position.y = -0.01;
    this.scene.add(gridHelper);
  }

  _bindEvents() {
    // 窗口大小调整
    window.addEventListener('resize', () => this._onResize());
    
    // 鼠标事件
    const canvas = this.renderer.domElement;
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('click', (e) => this._onClick(e));
    canvas.addEventListener('dblclick', (e) => this._onDoubleClick(e));
    
    // 键盘事件
    document.addEventListener('keydown', (e) => this._onKeyDown(e));
  }

  _onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _updateMouse(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _getIntersects() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // 获取所有可交互对象
    const interactables = [];
    
    // 岩点
    this.holdMeshes.forEach(({ mesh }) => {
      if (mesh.visible) interactables.push(mesh);
    });
    
    // 墙面
    if (this.wallMesh) {
      interactables.push(this.wallMesh);
    }
    
    return this.raycaster.intersectObjects(interactables, false);
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;  // 只处理左键
    
    this._updateMouse(e);
    const intersects = this._getIntersects();
    
    if (intersects.length === 0) return;
    
    const clickedObject = intersects[0].object;
    
    // 检查是否点击了岩点
    const holdEntry = this._findHoldByMesh(clickedObject);
    if (holdEntry) {
      const { holdId, mesh } = holdEntry;
      
      // 开始拖拽
      this.isDragging = true;
      this.dragHoldId = holdId;
      
      // 创建拖拽平面（平行于墙面）
      this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      
      // 计算拖拽偏移
      const intersectPoint = intersects[0].point;
      this.dragOffset.copy(mesh.position).sub(intersectPoint);
      
      // 禁用轨道控制器
      this.controls.enabled = false;
      
      this._emit('dragStart', { holdId, position: mesh.position });
    }
  }

  _onMouseMove(e) {
    this._updateMouse(e);
    
    // 高亮
    const intersects = this._getIntersects();
    
    if (intersects.length > 0) {
      const hoveredObject = intersects[0].object;
      const holdEntry = this._findHoldByMesh(hoveredObject);
      
      if (holdEntry && holdEntry.holdId !== this.highlightedHoldId) {
        this._setHighlight(holdEntry.holdId);
      } else if (!holdEntry) {
        this._clearHighlight();
      }
    } else {
      this._clearHighlight();
    }
    
    // 拖拽
    if (this.isDragging && this.dragHoldId) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const intersectPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
      
      if (intersectPoint) {
        const newPosition = intersectPoint.add(this.dragOffset);
        
        // 限制在墙面范围内
        newPosition.x = Math.max(0, Math.min(this._wallWidth || 4, newPosition.x));
        newPosition.y = Math.max(0, Math.min(this._wallHeight || 3, newPosition.y));
        newPosition.z = 0;  // 保持在墙面上
        
        this._updateHoldPosition(this.dragHoldId, newPosition);
        this._emit('dragMove', { 
          holdId: this.dragHoldId, 
          position: newPosition 
        });
      }
    }
  }

  _onMouseUp(e) {
    if (!this.isDragging) return;
    
    this.isDragging = false;
    this.controls.enabled = true;
    
    if (this.dragHoldId) {
      const holdEntry = this.holdMeshes.get(this.dragHoldId);
      this._emit('dragEnd', {
        holdId: this.dragHoldId,
        position: holdEntry?.mesh?.position
      });
    }
    
    this.dragHoldId = null;
    this.dragPlane = null;
  }

  _onClick(e) {
    if (this.isDragging) return;  // 拖拽过程中不触发点击
    
    this._updateMouse(e);
    const intersects = this._getIntersects();
    
    if (intersects.length === 0) {
      // 点击空白处，取消选择
      this._setSelection(null);
      this._emit('clickEmpty', {});
      return;
    }
    
    const clickedObject = intersects[0].object;
    
    // 检查岩点
    const holdEntry = this._findHoldByMesh(clickedObject);
    if (holdEntry) {
      const { holdId, mesh } = holdEntry;
      this._setSelection(holdId);
      this._emit('clickHold', { 
        holdId, 
        position: mesh.position.clone(),
        worldPosition: mesh.position.clone()
      });
      return;
    }
    
    // 检查墙面
    if (clickedObject === this.wallMesh) {
      const point = intersects[0].point;
      this._emit('clickWall', { 
        position: point,
        uv: intersects[0].uv
      });
    }
  }

  _onDoubleClick(e) {
    this._updateMouse(e);
    const intersects = this._getIntersects();
    
    if (intersects.length === 0) return;
    
    const holdEntry = this._findHoldByMesh(intersects[0].object);
    if (holdEntry) {
      this._emit('doubleClickHold', { holdId: holdEntry.holdId });
    }
  }

  _onKeyDown(e) {
    // 删除选中的岩点
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedHoldId) {
      this._emit('deleteHold', { holdId: this.selectedHoldId });
    }
    
    // ESC 取消选择
    if (e.key === 'Escape') {
      this._setSelection(null);
      this._emit('cancelSelection', {});
    }
  }

  _findHoldByMesh(mesh) {
    for (const [holdId, entry] of this.holdMeshes) {
      if (entry.mesh === mesh || entry.mesh.children.includes(mesh)) {
        return { holdId, ...entry };
      }
    }
    return null;
  }

  _setSelection(holdId) {
    // 清除之前的选择
    if (this.selectedHoldId && this.selectedHoldId !== holdId) {
      const prevEntry = this.holdMeshes.get(this.selectedHoldId);
      if (prevEntry) {
        this._resetMeshMaterial(prevEntry.mesh);
      }
    }
    
    this.selectedHoldId = holdId;
    
    // 高亮选中的
    if (holdId) {
      const entry = this.holdMeshes.get(holdId);
      if (entry) {
        this._setMeshSelected(entry.mesh);
      }
    }
    
    this._emit('selectionChanged', { holdId });
  }

  _setHighlight(holdId) {
    if (this.highlightedHoldId === holdId) return;
    
    // 清除之前的高亮
    if (this.highlightedHoldId && this.highlightedHoldId !== this.selectedHoldId) {
      const prevEntry = this.holdMeshes.get(this.highlightedHoldId);
      if (prevEntry) {
        this._resetMeshMaterial(prevEntry.mesh);
      }
    }
    
    this.highlightedHoldId = holdId;
    
    // 高亮当前的（如果没被选中）
    if (holdId && holdId !== this.selectedHoldId) {
      const entry = this.holdMeshes.get(holdId);
      if (entry) {
        this._setMeshHighlighted(entry.mesh);
      }
    }
  }

  _clearHighlight() {
    if (this.highlightedHoldId && this.highlightedHoldId !== this.selectedHoldId) {
      const entry = this.holdMeshes.get(this.highlightedHoldId);
      if (entry) {
        this._resetMeshMaterial(entry.mesh);
      }
    }
    this.highlightedHoldId = null;
  }

  _resetMeshMaterial(mesh) {
    if (mesh.userData.originalColor) {
      mesh.material.emissive.setHex(0x000000);
      mesh.material.emissiveIntensity = 0;
    }
  }

  _setMeshSelected(mesh) {
    mesh.material.emissive.setHex(0x00ff00);
    mesh.material.emissiveIntensity = 0.5;
  }

  _setMeshHighlighted(mesh) {
    mesh.material.emissive.setHex(0xffff00);
    mesh.material.emissiveIntensity = 0.3;
  }

  _updateHoldPosition(holdId, position) {
    const entry = this.holdMeshes.get(holdId);
    if (entry) {
      entry.mesh.position.copy(position);
    }
  }

  // ========== 公共 API ==========
  
  // 事件系统
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners.has(event)) return;
    const callbacks = this._listeners.get(event);
    const index = callbacks.indexOf(callback);
    if (index >= 0) callbacks.splice(index, 1);
  }

  _emit(event, data) {
    if (!this._listeners.has(event)) return;
    this._listeners.get(event).forEach(cb => {
      try { cb(data); } catch (e) { console.error('Scene3D event error:', e); }
    });
  }

  /**
   * 渲染墙面
   */
  renderWall(wallData) {
    // 清除旧墙面
    if (this.wallMesh) {
      this.scene.remove(this.wallMesh);
      this.wallMesh.geometry?.dispose();
      this.wallMesh.material?.dispose();
    }
    
    this._wallWidth = wallData.width || 4;
    this._wallHeight = wallData.height || 3;
    this._wallAngle = wallData.angle || 0;
    
    // 创建墙面几何体
    const geometry = new THREE.PlaneGeometry(this._wallWidth, this._wallHeight);
    
    // 创建材质
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a4a5a,
      roughness: 0.8,
      metalness: 0.2,
      side: THREE.DoubleSide
    });
    
    // 创建网格
    this.wallMesh = new THREE.Mesh(geometry, material);
    this.wallMesh.receiveShadow = true;
    
    // 定位（左下角在原点）
    this.wallMesh.position.set(this._wallWidth / 2, this._wallHeight / 2, 0);
    
    // 应用仰角
    if (this._wallAngle !== 0) {
      const angleRad = (this._wallAngle * Math.PI) / 180;
      this.wallMesh.rotation.x = angleRad;
    }
    
    // 添加边框
    this._addWallBorder();
    
    this.scene.add(this.wallMesh);
    
    // 更新相机目标
    this.controls.target.set(this._wallWidth / 2, this._wallHeight / 2, 0);
  }

  _addWallBorder() {
    const w = this._wallWidth;
    const h = this._wallHeight;
    
    const points = [
      new THREE.Vector3(0, 0, 0.01),
      new THREE.Vector3(w, 0, 0.01),
      new THREE.Vector3(w, h, 0.01),
      new THREE.Vector3(0, h, 0.01),
      new THREE.Vector3(0, 0, 0.01)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x888888 });
    const border = new THREE.Line(geometry, material);
    
    this.scene.add(border);
  }

  /**
   * 渲染单个岩点
   */
  renderHold(holdData) {
    // 清除旧的
    if (this.holdMeshes.has(holdData.id)) {
      this._removeHoldMesh(holdData.id);
    }
    
    const size = holdData.size || { width: 0.15, height: 0.15, depth: 0.08 };
    
    // 根据类型创建不同形状
    let geometry;
    switch (holdData.type) {
      case 'jug':
        geometry = new THREE.CylinderGeometry(
          size.width / 2 * 0.9,
          size.width / 2,
          size.height * 0.6,
          16,
          1,
          false
        );
        break;
        
      case 'crimp':
        geometry = new THREE.BoxGeometry(
          size.width * 0.6,
          size.height * 0.3,
          size.depth * 0.5
        );
        break;
        
      case 'sloper':
        geometry = new THREE.SphereGeometry(
          size.width / 2,
          16,
          8,
          0,
          Math.PI * 2,
          0,
          Math.PI / 2
        );
        break;
        
      case 'volume':
        geometry = new THREE.DodecahedronGeometry(
          size.width / 2,
          0
        );
        break;
        
      default:
        geometry = new THREE.BoxGeometry(
          size.width,
          size.height,
          size.depth
        );
    }
    
    // 创建材质
    const color = new THREE.Color(holdData.color);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7,
      metalness: 0.1,
      emissive: 0x000000,
      emissiveIntensity: 0
    });
    
    // 保存原始颜色
    material.userData.originalColor = color.getHex();
    
    // 创建网格
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    
    // 定位
    mesh.position.set(holdData.x, holdData.y, size.depth / 2 + 0.01);
    
    // 保存引用
    this.holdMeshes.set(holdData.id, {
      mesh,
      data: holdData,
      geometry,
      material
    });
    
    this.scene.add(mesh);
    
    return mesh;
  }

  /**
   * 批量渲染岩点
   */
  renderHolds(holdsData) {
    holdsData.forEach(hold => this.renderHold(hold));
  }

  /**
   * 更新岩点
   */
  updateHold(holdData) {
    const entry = this.holdMeshes.get(holdData.id);
    if (!entry) {
      this.renderHold(holdData);
      return;
    }
    
    // 更新位置
    entry.mesh.position.set(
      holdData.x,
      holdData.y,
      (holdData.size?.depth || 0.08) / 2 + 0.01
    );
    
    // 更新颜色
    if (holdData.color && entry.material.userData.originalColor !== new THREE.Color(holdData.color).getHex()) {
      entry.material.color.set(holdData.color);
      entry.material.userData.originalColor = new THREE.Color(holdData.color).getHex();
    }
    
    // 更新数据
    entry.data = holdData;
  }

  /**
   * 移除岩点
   */
  removeHold(holdId) {
    this._removeHoldMesh(holdId);
    
    if (this.selectedHoldId === holdId) {
      this.selectedHoldId = null;
    }
    if (this.highlightedHoldId === holdId) {
      this.highlightedHoldId = null;
    }
  }

  _removeHoldMesh(holdId) {
    const entry = this.holdMeshes.get(holdId);
    if (!entry) return;
    
    this.scene.remove(entry.mesh);
    entry.geometry?.dispose();
    entry.material?.dispose();
    this.holdMeshes.delete(holdId);
  }

  /**
   * 清除所有岩点
   */
  clearHolds() {
    this.holdMeshes.forEach((entry, id) => {
      this.scene.remove(entry.mesh);
      entry.geometry?.dispose();
      entry.material?.dispose();
    });
    this.holdMeshes.clear();
    this.selectedHoldId = null;
    this.highlightedHoldId = null;
  }

  /**
   * 渲染线路连接线
   */
  renderRoute(routeData, wallHolds) {
    // 清除旧的线路线
    this._clearRouteLines();
    
    const holdMap = new Map();
    wallHolds.forEach(h => holdMap.set(h.id, h));
    
    const routeHoldIds = routeData.holdIds || [];
    if (routeHoldIds.length < 2) return;
    
    // 按高度排序
    const sortedHolds = routeHoldIds
      .map(id => holdMap.get(id))
      .filter(h => h !== undefined)
      .sort((a, b) => a.y - b.y);
    
    if (sortedHolds.length < 2) return;
    
    // 创建连接线
    const points = sortedHolds.map(h => 
      new THREE.Vector3(h.x, h.y, 0.1)
    );
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: routeData.color || 0xff0000,
      linewidth: 3,
      transparent: true,
      opacity: 0.8
    });
    
    const line = new THREE.Line(geometry, material);
    this.routeLines.push({ line, routeId: routeData.id });
    this.scene.add(line);
    
    // 标记起点和终点
    if (routeData.startHoldId) {
      const startHold = holdMap.get(routeData.startHoldId);
      if (startHold) {
        this._addMarker(startHold, 0x00ff00, 'start');
      }
    }
    
    if (routeData.endHoldId) {
      const endHold = holdMap.get(routeData.endHoldId);
      if (endHold) {
        this._addMarker(endHold, 0xff0000, 'end');
      }
    }
  }

  _addMarker(hold, color, type) {
    const geometry = new THREE.RingGeometry(0.08, 0.12, 32);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(hold.x, hold.y + 0.2, 0.05);
    marker.userData.type = type;
    marker.userData.holdId = hold.id;
    
    this.routeLines.push({ line: marker, type: 'marker' });
    this.scene.add(marker);
  }

  _clearRouteLines() {
    this.routeLines.forEach(({ line }) => {
      this.scene.remove(line);
      line.geometry?.dispose();
      line.material?.dispose();
    });
    this.routeLines = [];
  }

  /**
   * 渲染落地区域
   */
  renderLandingZone(landingZoneData, color = 0x00aaff) {
    this._clearLandingZones();
    
    if (!landingZoneData || !landingZoneData.bounds) return;
    
    const { minX, maxX, frontDepth } = landingZoneData.bounds;
    const width = maxX - minX;
    
    // 创建半透明平面
    const geometry = new THREE.PlaneGeometry(width, frontDepth);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide
    });
    
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(
      minX + width / 2,
      0.01,
      frontDepth / 2
    );
    
    // 添加边框
    const borderPoints = [
      new THREE.Vector3(minX, 0.02, 0),
      new THREE.Vector3(maxX, 0.02, 0),
      new THREE.Vector3(maxX, 0.02, frontDepth),
      new THREE.Vector3(minX, 0.02, frontDepth),
      new THREE.Vector3(minX, 0.02, 0)
    ];
    
    const borderGeometry = new THREE.BufferGeometry().setFromPoints(borderPoints);
    const borderMaterial = new THREE.LineBasicMaterial({ color: color });
    const border = new THREE.Line(borderGeometry, borderMaterial);
    
    this.landingZoneMeshes.push(plane, border);
    this.scene.add(plane);
    this.scene.add(border);
  }

  _clearLandingZones() {
    this.landingZoneMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    });
    this.landingZoneMeshes = [];
  }

  /**
   * 清除整个场景
   */
  clear() {
    this.clearHolds();
    this._clearRouteLines();
    this._clearLandingZones();
    
    if (this.wallMesh) {
      this.scene.remove(this.wallMesh);
      this.wallMesh.geometry?.dispose();
      this.wallMesh.material?.dispose();
      this.wallMesh = null;
    }
  }

  /**
   * 聚焦到某个岩点
   */
  focusOnHold(holdId) {
    const entry = this.holdMeshes.get(holdId);
    if (!entry) return;
    
    this.controls.target.copy(entry.mesh.position);
    this._setSelection(holdId);
  }

  /**
   * 重置视角
   */
  resetView() {
    if (!this._wallWidth || !this._wallHeight) return;
    
    this.camera.position.set(
      this._wallWidth / 2 + 3,
      this._wallHeight / 2 + 2,
      5
    );
    this.controls.target.set(this._wallWidth / 2, this._wallHeight / 2, 0);
  }

  // 动画循环
  _animate() {
    this._animationId = requestAnimationFrame(() => this._animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * 销毁
   */
  dispose() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
    
    this.clear();
    
    window.removeEventListener('resize', this._onResize);
    
    this.renderer.dispose();
    this.controls.dispose();
    
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
