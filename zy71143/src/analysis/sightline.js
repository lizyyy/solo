import * as THREE from 'three'

export class SightlineAnalyzer {
  constructor(scene) {
    this.scene = scene
    this.raycaster = new THREE.Raycaster()
    this.sightlines = []
    this.analysisResults = []
    this.sightlinesGroup = null
  }

  analyzeAllViewpoints(viewpointsGroup, screensGroup, obstaclesGroup) {
    this.clearSightlines()
    this.analysisResults = []
    this.sightlinesGroup = this.scene.getObjectByName('sightlines')
    
    if (!this.sightlinesGroup) {
      this.sightlinesGroup = new THREE.Group()
      this.sightlinesGroup.name = 'sightlines'
      this.scene.add(this.sightlinesGroup)
    }

    const viewpointList = []
    viewpointsGroup.children.forEach(vpGroup => {
      const head = vpGroup.children.find(c => c.geometry?.type === 'SphereGeometry')
      if (head) {
        const worldPos = new THREE.Vector3()
        head.getWorldPosition(worldPos)
        viewpointList.push({
          group: vpGroup,
          position: worldPos,
          data: vpGroup.userData.viewpointData,
          index: vpGroup.userData.index
        })
      }
    })

    const screenList = []
    screensGroup.children.forEach(screenGroup => {
      const screen = screenGroup.children.find(c => c.material?.emissive)
      if (screen) {
        const worldPos = new THREE.Vector3()
        screen.getWorldPosition(worldPos)
        screenList.push({
          mesh: screen,
          position: worldPos,
          data: screen.userData.screenData,
          screenGroup
        })
      }
    })

    const obstacleMeshes = []
    obstaclesGroup.traverse(obj => {
      if (obj.isMesh) {
        obstacleMeshes.push(obj)
      }
    })

    viewpointList.forEach((vp, vpIdx) => {
      const vpResult = {
        viewpoint: vp.data.name,
        viewpointIndex: vp.index,
        position: { x: vp.position.x, y: vp.position.y, z: vp.position.z },
        screenResults: [],
        hasVisibleScreen: false
      }

      screenList.forEach((screen, screenIdx) => {
        const direction = new THREE.Vector3()
          .subVectors(screen.position, vp.position)
          .normalize()

        const distance = vp.position.distanceTo(screen.position)

        this.raycaster.set(vp.position, direction)
        const intersects = this.raycaster.intersectObjects(obstacleMeshes)

        let isBlocked = false
        let blockingObject = null
        let blockDistance = distance

        if (intersects.length > 0) {
          const firstIntersect = intersects[0]
          if (firstIntersect.distance < distance - 0.5) {
            isBlocked = true
            blockingObject = firstIntersect.object
            blockDistance = firstIntersect.distance
          }
        }

        const sightline = this.createSightline(
          vp.position,
          screen.position,
          isBlocked,
          blockDistance
        )
        this.sightlinesGroup.add(sightline)
        this.sightlines.push(sightline)

        if (!isBlocked) {
          vpResult.hasVisibleScreen = true
        }

        vpResult.screenResults.push({
          screenName: screen.data.name,
          screenIndex: screenIdx,
          isVisible: !isBlocked,
          distance: distance.toFixed(2),
          blockingObject: blockingObject?.userData?.name || null,
          blockDistance: isBlocked ? blockDistance.toFixed(2) : null
        })
      })

      this.updateViewpointColor(vp.group, vpResult.hasVisibleScreen)
      this.analysisResults.push(vpResult)
    })

    return this.analysisResults
  }

  createSightline(start, end, isBlocked, blockDistance) {
    const group = new THREE.Group()
    
    const actualEnd = isBlocked 
      ? start.clone().add(end.clone().sub(start).normalize().multiplyScalar(blockDistance))
      : end

    const points = [start, actualEnd]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    
    const color = isBlocked ? 0xef4444 : 0x22c55e
    const material = new THREE.LineBasicMaterial({ 
      color,
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    })
    
    const line = new THREE.Line(geometry, material)
    line.userData = { isBlocked, type: 'sightline' }
    group.add(line)

    if (isBlocked) {
      const markerGeometry = new THREE.SphereGeometry(0.2, 8, 8)
      const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xef4444,
        transparent: true,
        opacity: 0.9
      })
      const marker = new THREE.Mesh(markerGeometry, markerMaterial)
      marker.position.copy(actualEnd)
      group.add(marker)
    }

    return group
  }

  updateViewpointColor(vpGroup, hasVisibleScreen) {
    vpGroup.traverse(obj => {
      if (obj.isMesh && obj.material?.color) {
        if (obj.geometry.type === 'CylinderGeometry') {
          const newColor = hasVisibleScreen ? 0x22c55e : 0xef4444
          obj.material.color.setHex(newColor)
        }
      }
    })
  }

  highlightObstacles() {
    const blockingNames = new Set()
    this.analysisResults.forEach(vp => {
      vp.screenResults.forEach(sr => {
        if (sr.blockingObject) {
          blockingNames.add(sr.blockingObject)
        }
      })
    })

    this.scene.getObjectByName('obstacles')?.traverse(obj => {
      if (obj.isMesh && obj.userData.name) {
        if (blockingNames.has(obj.userData.name)) {
          if (!obj.userData.originalMaterial) {
            obj.userData.originalMaterial = obj.material.clone()
          }
          obj.material.emissive = new THREE.Color(0xff0000)
          obj.material.emissiveIntensity = 0.5
        }
      }
    })
  }

  clearSightlines() {
    if (this.sightlinesGroup) {
      while (this.sightlinesGroup.children.length > 0) {
        const child = this.sightlinesGroup.children[0]
        this.sightlinesGroup.remove(child)
        if (child.geometry) child.geometry.dispose()
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      }
    }
    this.sightlines = []
  }

  getAnalysisResults() {
    return this.analysisResults
  }

  getStatistics() {
    const total = this.analysisResults.length
    const visible = this.analysisResults.filter(r => r.hasVisibleScreen).length
    const blocked = total - visible
    const rate = total > 0 ? ((visible / total) * 100).toFixed(1) : 0

    return {
      totalViewpoints: total,
      visibleViewpoints: visible,
      blockedViewpoints: blocked,
      visibilityRate: rate
    }
  }

  getBlockedViewpoints() {
    return this.analysisResults.filter(r => !r.hasVisibleScreen)
  }

  getBlockingObstacles() {
    const obstacles = {}
    this.analysisResults.forEach(vp => {
      vp.screenResults.forEach(sr => {
        if (sr.blockingObject) {
          if (!obstacles[sr.blockingObject]) {
            obstacles[sr.blockingObject] = { count: 0, viewpoints: [] }
          }
          obstacles[sr.blockingObject].count++
          obstacles[sr.blockingObject].viewpoints.push(vp.viewpoint)
        }
      })
    })
    return obstacles
  }
}
