import * as THREE from 'three'

export class LayerRenderer {
  constructor(scene) {
    this.scene = scene
    this.layerMeshes = new Map()
    this.layerObjects = new Map()
    this.selectedLayer = null
  }

  createLayerMesh(context, trenchDimensions) {
    const geo = context.geometry
    const dim = trenchDimensions

    const xMin = geo.x_min ?? dim.x_min
    const xMax = geo.x_max ?? dim.x_max
    const yMin = geo.y_min ?? dim.y_min
    const yMax = geo.y_max ?? dim.y_max
    const zMin = geo.z_min ?? dim.z_min
    const zMax = geo.z_max ?? dim.z_max

    const width = xMax - xMin
    const depth = yMax - yMin
    const height = zMax - zMin

    const geometry = new THREE.BoxGeometry(width, height, depth)
    
    const centerX = (xMin + xMax) / 2
    const centerY = (zMin + zMax) / 2
    const centerZ = (yMin + yMax) / 2

    const color = new THREE.Color(context.color)
    
    const material = new THREE.MeshPhongMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      shininess: 10
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(centerX, centerY, centerZ)
    mesh.userData = {
      layerId: context.id,
      context: context,
      isLayer: true
    }

    const edges = new THREE.EdgesGeometry(geometry)
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x000000,
      linewidth: 2
    })
    const wireframe = new THREE.LineSegments(edges, lineMaterial)
    wireframe.position.copy(mesh.position)
    wireframe.userData = mesh.userData

    const group = new THREE.Group()
    group.add(mesh)
    group.add(wireframe)
    group.userData = mesh.userData

    this.layerMeshes.set(context.id, { mesh, wireframe, group })
    this.layerObjects.set(context.id, context)

    return { group, mesh, wireframe }
  }

  createAllLayers(contexts, trenchDimensions) {
    contexts.forEach((context) => {
      const { group } = this.createLayerMesh(context, trenchDimensions)
      this.scene.add(group)
    })
  }

  highlightLayer(layerId) {
    this.resetAllLayers()

    const layerData = this.layerMeshes.get(layerId)
    if (layerData) {
      const { mesh, wireframe } = layerData
      mesh.material.emissive = new THREE.Color(0x444444)
      mesh.material.opacity = 0.9
      wireframe.material.color = new THREE.Color(0xffffff)
      this.selectedLayer = layerId
    }
  }

  resetAllLayers() {
    this.layerMeshes.forEach(({ mesh, wireframe }, layerId) => {
      const context = this.layerObjects.get(layerId)
      if (context) {
        mesh.material.emissive = new THREE.Color(0x000000)
        mesh.material.opacity = 0.7
        wireframe.material.color = new THREE.Color(0x000000)
      }
    })
    this.selectedLayer = null
  }

  setLayerVisible(layerId, visible) {
    const layerData = this.layerMeshes.get(layerId)
    if (layerData) {
      layerData.group.visible = visible
    }
  }

  setAllVisible(visible) {
    this.layerMeshes.forEach(({ group }) => {
      group.visible = visible
    })
  }

  setWireframeVisible(visible) {
    this.layerMeshes.forEach(({ wireframe }) => {
      wireframe.visible = visible
    })
  }

  getLayerMesh(layerId) {
    return this.layerMeshes.get(layerId)
  }

  getLayerByMesh(mesh) {
    if (!mesh) return null
    
    if (mesh.userData && mesh.userData.layerId) {
      return mesh.userData
    }

    let current = mesh
    while (current.parent) {
      current = current.parent
      if (current.userData && current.userData.layerId) {
        return current.userData
      }
    }

    return null
  }

  clear() {
    this.layerMeshes.forEach(({ group }) => {
      this.scene.remove(group)
      group.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    })
    this.layerMeshes.clear()
    this.layerObjects.clear()
    this.selectedLayer = null
  }
}

export default LayerRenderer
