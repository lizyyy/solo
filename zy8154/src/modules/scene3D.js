import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Scene3D {
  constructor(container, stateManager, rulesEngine) {
    this.container = container;
    this.stateManager = stateManager;
    this.rulesEngine = rulesEngine;
    
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.mouse = null;
    
    this.teethMeshes = new Map();
    this.attachmentMeshes = new Map();
    this.gizmo = null;
    
    this.selectedMesh = null;
    this.isDragging = false;
    this.dragPlane = null;
    this.dragOffset = new THREE.Vector3();
    
    this.onAttachmentSelect = null;
    this.onAttachmentMove = null;
    
    this.animationId = null;
    
    this.init();
  }

  init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    this.camera.position.set(0, 8, 10);
    this.camera.lookAt(0, 0, 0);
    
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true 
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.screenSpacePanning = true;
    
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    
    this.setupLights();
    this.setupGrid();
    this.setupEvents();
    this.animate();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    this.scene.add(directionalLight);
    
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.4);
    frontLight.position.set(0, 0, 10);
    this.scene.add(frontLight);
    
    const backLight = new THREE.DirectionalLight(0x8888ff, 0.2);
    backLight.position.set(0, 0, -10);
    this.scene.add(backLight);
  }

  setupGrid() {
    const gridHelper = new THREE.GridHelper(20, 20, 0x444466, 0x333355);
    gridHelper.position.y = -2;
    this.scene.add(gridHelper);
    
    const axesHelper = new THREE.AxesHelper(3);
    axesHelper.position.y = -2;
    this.scene.add(axesHelper);
  }

  setupEvents() {
    this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.renderer.domElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.renderer.domElement.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    
    window.addEventListener('resize', () => this.onWindowResize());
  }

  onMouseDown(event) {
    this.updateMousePosition(event);
    
    const intersects = this.getIntersects();
    const attachmentIntersect = intersects.find(i => 
      this.attachmentMeshes.has(i.object) || 
      (i.object.userData && i.object.userData.attachmentId)
    );
    
    if (attachmentIntersect) {
      const mesh = attachmentIntersect.object;
      const attachmentId = mesh.userData.attachmentId || 
                          Array.from(this.attachmentMeshes.keys()).find(k => 
                            this.attachmentMeshes.get(k) === mesh || 
                            this.attachmentMeshes.get(k)?.children?.includes(mesh)
                          );
      
      if (attachmentId) {
        this.selectAttachment(attachmentId);
        this.isDragging = true;
        this.controls.enabled = false;
        
        this.dragPlane = new THREE.Plane(
          new THREE.Vector3(0, 1, 0),
          -attachmentIntersect.point.y
        );
        
        const targetPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.dragPlane, targetPoint);
        this.dragOffset.copy(mesh.position).sub(targetPoint);
      }
    } else {
      this.deselectAttachment();
    }
  }

  onMouseMove(event) {
    this.updateMousePosition(event);
    
    if (this.isDragging && this.selectedMesh) {
      const targetPoint = new THREE.Vector3();
      this.raycaster.ray.intersectPlane(this.dragPlane, targetPoint);
      
      const newPosition = targetPoint.add(this.dragOffset);
      const attachmentId = this.selectedMesh.userData.attachmentId;
      
      if (attachmentId && this.onAttachmentMove) {
        const tooth = this.getToothForAttachment(attachmentId);
        if (tooth) {
          const localPos = {
            x: newPosition.x - tooth.center.x,
            y: newPosition.y - tooth.center.y,
            z: newPosition.z - tooth.center.z
          };
          this.onAttachmentMove(attachmentId, localPos);
        }
      }
    } else {
      this.highlightHovered();
    }
  }

  onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false;
      this.controls.enabled = true;
    }
  }

  onDoubleClick(event) {
    this.updateMousePosition(event);
    const intersects = this.getIntersects();
    const attachmentIntersect = intersects.find(i => 
      (i.object.userData && i.object.userData.attachmentId)
    );
    
    if (attachmentIntersect) {
      const attachmentId = attachmentIntersect.object.userData.attachmentId;
      if (this.onAttachmentSelect) {
        this.onAttachmentSelect(attachmentId);
      }
    }
  }

  updateMousePosition(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  getIntersects() {
    const allMeshes = [];
    this.attachmentMeshes.forEach(mesh => {
      allMeshes.push(mesh);
      mesh.traverse(child => {
        if (child.isMesh) allMeshes.push(child);
      });
    });
    this.teethMeshes.forEach(mesh => {
      allMeshes.push(mesh);
    });
    
    this.raycaster.setFromCamera(this.mouse, this.camera);
    return this.raycaster.intersectObjects(allMeshes, true);
  }

  highlightHovered() {
    const intersects = this.getIntersects();
    const attachmentIntersect = intersects.find(i => 
      (i.object.userData && i.object.userData.attachmentId) ||
      Array.from(this.attachmentMeshes.values()).some(m => 
        m === i.object || m?.children?.includes(i.object)
      )
    );
    
    this.attachmentMeshes.forEach((mesh, id) => {
      const isHovered = attachmentIntersect && 
        (attachmentIntersect.object === mesh || 
         mesh.children?.includes(attachmentIntersect.object));
      const isSelected = this.selectedMesh === mesh;
      
      this.setAttachmentHighlight(mesh, isSelected, isHovered);
    });
  }

  setAttachmentHighlight(mesh, isSelected, isHovered) {
    mesh.traverse(child => {
      if (child.isMesh && child.material) {
        if (isSelected) {
          child.material.emissive = new THREE.Color(0x00ff00);
          child.material.emissiveIntensity = 0.5;
        } else if (isHovered) {
          child.material.emissive = new THREE.Color(0xffff00);
          child.material.emissiveIntensity = 0.3;
        } else {
          child.material.emissive = new THREE.Color(0x000000);
          child.material.emissiveIntensity = 0;
        }
      }
    });
  }

  onWindowResize() {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  clearScene() {
    this.teethMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach(m => m.dispose());
        } else {
          mesh.material.dispose();
        }
      }
    });
    this.teethMeshes.clear();
    
    this.attachmentMeshes.forEach(mesh => {
      this.scene.remove(mesh);
      mesh.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
    });
    this.attachmentMeshes.clear();
  }

  renderTeeth(teethData) {
    this.clearScene();
    
    const renderArch = (teeth, isUpper) => {
      teeth.forEach(tooth => {
        const mesh = this.createToothMesh(tooth, isUpper);
        this.teethMeshes.set(tooth.id, mesh);
        this.scene.add(mesh);
      });
    };
    
    if (teethData.upper) {
      renderArch(teethData.upper, true);
    }
    if (teethData.lower) {
      renderArch(teethData.lower, false);
    }
  }

  createToothMesh(tooth, isUpper) {
    const group = new THREE.Group();
    
    const toothGeometry = new THREE.BoxGeometry(
      tooth.size.width,
      tooth.size.height,
      tooth.size.depth
    );
    
    const toothMaterial = new THREE.MeshPhongMaterial({
      color: tooth.isMissing ? 0x666666 : 0xe8f4f8,
      transparent: true,
      opacity: tooth.isMissing ? 0.3 : 0.8,
      shininess: 100,
      specular: 0x444444
    });
    
    const toothMesh = new THREE.Mesh(toothGeometry, toothMaterial);
    
    group.position.set(
      tooth.center.x,
      tooth.center.y,
      tooth.center.z
    );
    group.rotation.set(
      tooth.rotation.x,
      tooth.rotation.y,
      tooth.rotation.z
    );
    
    group.add(toothMesh);
    
    if (!tooth.isMissing) {
      const labelCanvas = document.createElement('canvas');
      const ctx = labelCanvas.getContext('2d');
      labelCanvas.width = 64;
      labelCanvas.height = 32;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, 64, 32);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(tooth.id), 32, 16);
      
      const labelTexture = new THREE.CanvasTexture(labelCanvas);
      const labelMaterial = new THREE.SpriteMaterial({ 
        map: labelTexture,
        transparent: true
      });
      const labelSprite = new THREE.Sprite(labelMaterial);
      labelSprite.position.y = tooth.size.height / 2 + 0.3;
      labelSprite.scale.set(0.5, 0.25, 1);
      group.add(labelSprite);
    }
    
    group.userData = { toothId: tooth.id, tooth };
    
    return group;
  }

  renderAttachments(attachments, currentStep) {
    this.attachmentMeshes.forEach((mesh, id) => {
      this.scene.remove(mesh);
    });
    this.attachmentMeshes.clear();
    this.selectedMesh = null;
    
    const currentAttachments = attachments.filter(a => a.step === currentStep);
    
    currentAttachments.forEach(attachment => {
      const mesh = this.createAttachmentMesh(attachment);
      this.attachmentMeshes.set(attachment.id, mesh);
      this.scene.add(mesh);
    });
  }

  createAttachmentMesh(attachment) {
    const group = new THREE.Group();
    group.userData.attachmentId = attachment.id;
    group.userData.attachment = { ...attachment };
    
    const tooth = this.stateManager.getToothById(attachment.toothNumber);
    
    let color;
    switch (attachment.type) {
      case 'bracket':
        color = 0xff6b6b;
        break;
      case 'button':
        color = 0x4ecdc4;
        break;
      case 'hook':
        color = 0xffd93d;
        break;
      default:
        color = 0x95e1d3;
    }
    
    const geometry = new THREE.BoxGeometry(
      attachment.size.width,
      attachment.size.height,
      attachment.size.depth
    );
    
    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 50,
      specular: 0x222222
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.attachmentId = attachment.id;
    group.add(mesh);
    
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x333333 });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    group.add(edges);
    
    if (tooth) {
      group.position.set(
        tooth.center.x + attachment.position.x,
        tooth.center.y + attachment.position.y,
        tooth.center.z + attachment.position.z
      );
      
      group.rotation.set(
        tooth.rotation.x + attachment.rotation.x,
        tooth.rotation.y + attachment.rotation.y,
        tooth.rotation.z + attachment.rotation.z
      );
    }
    
    if (attachment.isMirrored) {
      const mirrorIndicator = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x0000ff })
      );
      mirrorIndicator.position.z = attachment.size.depth / 2 + 0.05;
      group.add(mirrorIndicator);
    }
    
    return group;
  }

  getToothForAttachment(attachmentId) {
    const attachment = this.stateManager.getAttachmentById(attachmentId);
    if (!attachment) return null;
    return this.stateManager.getToothById(attachment.toothNumber);
  }

  selectAttachment(attachmentId) {
    const mesh = this.attachmentMeshes.get(attachmentId);
    if (mesh) {
      this.selectedMesh = mesh;
      this.setAttachmentHighlight(mesh, true, false);
      
      if (this.onAttachmentSelect) {
        this.onAttachmentSelect(attachmentId);
      }
    }
  }

  deselectAttachment() {
    if (this.selectedMesh) {
      this.setAttachmentHighlight(this.selectedMesh, false, false);
      this.selectedMesh = null;
    }
  }

  updateAttachmentPosition(attachmentId) {
    const mesh = this.attachmentMeshes.get(attachmentId);
    const attachment = this.stateManager.getAttachmentById(attachmentId);
    const tooth = this.stateManager.getToothById(attachment?.toothNumber);
    
    if (mesh && attachment && tooth) {
      mesh.position.set(
        tooth.center.x + attachment.position.x,
        tooth.center.y + attachment.position.y,
        tooth.center.z + attachment.position.z
      );
    }
  }

  setCameraView(view) {
    const positions = {
      front: new THREE.Vector3(0, 0, 12),
      back: new THREE.Vector3(0, 0, -12),
      top: new THREE.Vector3(0, 12, 0),
      left: new THREE.Vector3(-12, 0, 0),
      right: new THREE.Vector3(12, 0, 0),
      iso: new THREE.Vector3(8, 6, 8)
    };
    
    const targetPos = positions[view] || positions.front;
    
    const startPos = this.camera.position.clone();
    const duration = 500;
    const startTime = Date.now();
    
    const animateCamera = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easeT = 1 - Math.pow(1 - t, 3);
      
      this.camera.position.lerpVectors(startPos, targetPos, easeT);
      this.camera.lookAt(0, 0, 0);
      
      if (t < 1) {
        requestAnimationFrame(animateCamera);
      }
    };
    
    animateCamera();
  }

  highlightIssues(issues) {
    this.attachmentMeshes.forEach((mesh, id) => {
      this.setAttachmentHighlight(mesh, false, false);
    });
    
    issues.forEach(issue => {
      if (issue.affectedAttachments) {
        issue.affectedAttachments.forEach(attId => {
          const mesh = this.attachmentMeshes.get(attId);
          if (mesh) {
            mesh.traverse(child => {
              if (child.isMesh && child.material) {
                child.material.emissive = issue.severity === 'error' 
                  ? new THREE.Color(0xff0000) 
                  : new THREE.Color(0xffa500);
                child.material.emissiveIntensity = 0.6;
              }
            });
          }
        });
      }
    });
  }

  dispose() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.clearScene();
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
