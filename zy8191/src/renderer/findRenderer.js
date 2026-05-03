import * as THREE from 'three'

export class FindRenderer {
  constructor(scene) {
    this.scene = scene
    this.findMeshes = new Map()
    this.findObjects = new Map()
    this.selectedFind = null
  }

  createFindMesh(find, contextMap) {
    const coords = find.coordinates
    const x = coords.x ?? 0
    const y = coords.y ?? 0
    const z = coords.z ?? 0

    const geometry = new THREE.SphereGeometry(0.15, 16, 16)
    
    let color = 0xffff00
    if (find.type === '陶器' || find.type === 'ceramic') {
      color = 0xff8800
    } else if (find.type === '石器' || find.type === 'stone') {
      color = 0x888888
    } else if (find.type === '骨器' || find.type === 'bone') {
      color = 0xd4a574
    } else if (find.type === '金属' || find.type === 'metal') {
      color = 0xffd700
    }

    const material = new THREE.MeshPhongMaterial({
      color: color,
      shininess: 100,
      transparent: true,
      opacity: 0.9
    })

    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, z, y)
    mesh.userData = {
      findId: find.id,
      find: find,
      layerId: find.layerId,
      isFind: true
    }

    const ringGeometry = new THREE.RingGeometry(0.12, 0.18, 32)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    })
    const ring = new THREE.Mesh(ringGeometry, ringMaterial)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(x, z + 0.01, y)
    ring.userData = mesh.userData

    const group = new THREE.Group()
    group.add(mesh)
    group.add(ring)
    group.userData = mesh.userData

    this.findMeshes.set(find.id, { mesh, ring, group })
    this.findObjects.set(find.id, find)

    return { group, mesh, ring }
  }

  createAllFinds(finds, contextMap) {
    finds.forEach((find) => {
      const { group } = this.createFindMesh(find, contextMap)
      this.scene.add(group)
    })
  }

  highlightFind(findId) {
    this.resetAllFinds()

    const findData = this.findMeshes.get(findId)
    if (findData) {
      const { mesh, ring } = findData
      mesh.material.emissive = new THREE.Color(0x444444)
      mesh.scale.set(1.3, 1.3, 1.3)
      ring.material.opacity = 1
      ring.material.color = new THREE.Color(0x00ffff)
      this.selectedFind = findId
    }
  }

  resetAllFinds() {
    this.findMeshes.forEach(({ mesh, ring }) => {
      mesh.material.emissive = new THREE.Color(0x000000)
      mesh.scale.set(1, 1, 1)
      ring.material.opacity = 0.5
      ring.material.color = new THREE.Color(0xffffff)
    })
    this.selectedFind = null
  }

  setFindVisible(findId, visible) {
    const findData = this.findMeshes.get(findId)
    if (findData) {
      findData.group.visible = visible
    }
  }

  setAllVisible(visible) {
    this.findMeshes.forEach(({ group }) => {
      group.visible = visible
    })
  }

  getFindsByLayer(layerId) {
    const layerFinds = []
    this.findObjects.forEach((find, findId) => {
      if (find.layerId === layerId) {
        layerFinds.push({ find, ...this.findMeshes.get(findId) })
      }
    })
    return layerFinds
  }

  getFindMesh(findId) {
    return this.findMeshes.get(findId)
  }

  getFindByMesh(mesh) {
    if (!mesh) return null
    
    if (mesh.userData && mesh.userData.findId) {
      return mesh.userData
    }

    let current = mesh
    while (current.parent) {
      current = current.parent
      if (current.userData && current.userData.findId) {
        return current.userData
      }
    }

    return null
  }

  createLabel(find) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    canvas.width = 256
    canvas.height = 64

    context.fillStyle = 'rgba(0, 0, 0, 0.8)'
    context.fillRect(0, 0, canvas.width, canvas.height)

    context.font = '24px Arial'
    context.fillStyle = '#ffffff'
    context.textAlign = 'center'
    context.fillText(find.id, canvas.width / 2, 40)

    const texture = new THREE.CanvasTexture(canvas)
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
    const sprite = new THREE.Sprite(spriteMaterial)
    
    sprite.scale.set(1, 0.25, 1)
    sprite.position.set(
      find.coordinates.x,
      (find.coordinates.z ?? 0) + 0.5,
      find.coordinates.y
    )
    sprite.userData = {
      findId: find.id,
      isLabel: true
    }

    return sprite
  }

  clear() {
    this.findMeshes.forEach(({ group }) => {
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
    this.findMeshes.clear()
    this.findObjects.clear()
    this.selectedFind = null
  }
}

export default FindRenderer
