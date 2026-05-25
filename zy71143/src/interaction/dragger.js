import * as THREE from 'three'

export class DragController {
  constructor(app) {
    this.app = app
    this.isDragging = false
    this.draggedObject = null
    this.dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    this.dragOffset = new THREE.Vector3()
    this.dragIntersection = new THREE.Vector3()
    this.inverseMatrix = new THREE.Matrix4()
    
    this.setupEventListeners()
  }

  setupEventListeners() {
    const renderer = this.app.renderer
    const domElement = renderer.domElement

    domElement.addEventListener('mousedown', (e) => this.onMouseDown(e))
    domElement.addEventListener('mousemove', (e) => this.onMouseMove(e))
    domElement.addEventListener('mouseup', (e) => this.onMouseUp(e))
    domElement.addEventListener('mouseleave', (e) => this.onMouseUp(e))
  }

  onMouseDown(event) {
    const container = document.getElementById('scene-container')
    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2()
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.app.camera)

    const draggableMeshes = []
    Object.values(this.app.objects).forEach(group => {
      if (group && group.children) {
        group.traverse(obj => {
          if (obj.isMesh && obj.userData.draggable) {
            draggableMeshes.push(obj)
          }
        })
      }
    })

    const intersects = raycaster.intersectObjects(draggableMeshes)
    
    if (intersects.length > 0) {
      this.isDragging = true
      this.draggedObject = intersects[0].object
      
      this.app.controls.enabled = false
      
      raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection)
      this.dragOffset.copy(this.dragIntersection).sub(this.draggedObject.parent.position)
      
      this.inverseMatrix.copy(this.app.camera.matrixWorldInverse)
      
      this.app.selectObject(this.draggedObject)
    }
  }

  onMouseMove(event) {
    if (!this.isDragging || !this.draggedObject) return

    const container = document.getElementById('scene-container')
    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2()
    mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.app.camera)

    if (raycaster.ray.intersectPlane(this.dragPlane, this.dragIntersection)) {
      const newPos = this.dragIntersection.clone().sub(this.dragOffset)
      
      const parent = this.draggedObject.parent
      if (parent && parent.userData) {
        parent.position.x = newPos.x
        parent.position.z = newPos.z
        
        parent.traverse(child => {
          if (child.userData.viewpointData) {
            child.userData.viewpointData.position.x = newPos.x
            child.userData.viewpointData.position.z = newPos.z
          }
          if (child.userData.screenData) {
            child.userData.screenData.position.x = newPos.x
            child.userData.screenData.position.z = newPos.z
          }
          if (child.userData.obstacleData) {
            child.userData.obstacleData.position.x = newPos.x
            child.userData.obstacleData.position.z = newPos.z
          }
        })
      }
    }
  }

  onMouseUp(event) {
    if (this.isDragging) {
      this.isDragging = false
      this.app.controls.enabled = true
      
      this.refreshSightlineAnalysis()
      
      this.draggedObject = null
    }
  }

  refreshSightlineAnalysis() {
    if (this.app.objects.viewpoints && this.app.objects.screens && this.app.objects.obstacles) {
      this.app.sightlineAnalyzer.analyzeAllViewpoints(
        this.app.objects.viewpoints,
        this.app.objects.screens,
        this.app.objects.obstacles
      )
      this.app.uiController.updateStatusDisplay()
      this.app.uiController.updateReportPreview()
    }
  }

  dispose() {
    const domElement = this.app.renderer.domElement
    domElement.removeEventListener('mousedown', this.onMouseDown)
    domElement.removeEventListener('mousemove', this.onMouseMove)
    domElement.removeEventListener('mouseup', this.onMouseUp)
    domElement.removeEventListener('mouseleave', this.onMouseUp)
  }
}
