import * as THREE from 'three'

export function createSceneObjects(scene, data) {
  const group = {
    ride: createRide(data.ride),
    queue: createQueue(data.queue),
    screens: createScreens(data.screens),
    obstacles: createObstacles(data.obstacles),
    viewpoints: createViewpoints(data.viewpoints),
    sightlines: new THREE.Group()
  }

  Object.values(group).forEach(obj => {
    if (obj) scene.add(obj)
  })

  return group
}

function createRide(rideData) {
  const group = new THREE.Group()
  group.name = 'ride'

  const baseGeometry = new THREE.CylinderGeometry(8, 10, 2, 32)
  const baseMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d3748,
    metalness: 0.7,
    roughness: 0.3
  })
  const base = new THREE.Mesh(baseGeometry, baseMaterial)
  base.position.set(rideData.position.x, 1, rideData.position.z)
  base.castShadow = true
  base.receiveShadow = true
  base.userData = { type: 'ride', name: rideData.name, selectable: true }
  group.add(base)

  const towerGeometry = new THREE.CylinderGeometry(3, 4, 15, 16)
  const towerMaterial = new THREE.MeshStandardMaterial({
    color: 0xe94560,
    metalness: 0.5,
    roughness: 0.5
  })
  const tower = new THREE.Mesh(towerGeometry, towerMaterial)
  tower.position.set(rideData.position.x, 10.5, rideData.position.z)
  tower.castShadow = true
  tower.userData = { type: 'ride', name: rideData.name, selectable: true }
  group.add(tower)

  const armGeometry = new THREE.BoxGeometry(2, 2, 12)
  const armMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a90d9,
    metalness: 0.6,
    roughness: 0.4
  })
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(armGeometry, armMaterial)
    arm.position.set(rideData.position.x, 18, rideData.position.z)
    arm.rotation.y = (i * Math.PI) / 2
    arm.castShadow = true
    arm.userData = { type: 'ride', name: rideData.name, selectable: true }
    group.add(arm)

    const seatGeometry = new THREE.SphereGeometry(1.2, 16, 16)
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.3,
      roughness: 0.7
    })
    const seat = new THREE.Mesh(seatGeometry, seatMaterial)
    const angle = (i * Math.PI) / 2
    seat.position.set(
      rideData.position.x + Math.sin(angle) * 8,
      18,
      rideData.position.z + Math.cos(angle) * 8
    )
    seat.castShadow = true
    seat.userData = { type: 'ride', name: rideData.name, selectable: true }
    group.add(seat)
  }

  return group
}

function createQueue(queueData) {
  const group = new THREE.Group()
  group.name = 'queue'

  const postMaterial = new THREE.MeshStandardMaterial({
    color: 0x718096,
    metalness: 0.8,
    roughness: 0.2
  })
  const beltMaterial = new THREE.MeshStandardMaterial({
    color: 0xe53e3e,
    metalness: 0.2,
    roughness: 0.8
  })

  const path = queueData.path
  for (let i = 0; i < path.length; i++) {
    const point = path[i]
    
    const postGeometry = new THREE.CylinderGeometry(0.15, 0.2, 1.5, 8)
    const post = new THREE.Mesh(postGeometry, postMaterial)
    post.position.set(point.x, 0.75, point.z)
    post.castShadow = true
    post.userData = { type: 'queue', name: '排队栏', selectable: true }
    group.add(post)

    const topGeometry = new THREE.SphereGeometry(0.25, 16, 16)
    const topMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      metalness: 0.9,
      roughness: 0.1
    })
    const top = new THREE.Mesh(topGeometry, topMaterial)
    top.position.set(point.x, 1.6, point.z)
    top.castShadow = true
    top.userData = { type: 'queue', name: '排队栏', selectable: true }
    group.add(top)

    if (i < path.length - 1) {
      const nextPoint = path[i + 1]
      const distance = Math.sqrt(
        Math.pow(nextPoint.x - point.x, 2) + 
        Math.pow(nextPoint.z - point.z, 2)
      )
      
      const beltGeometry = new THREE.CylinderGeometry(0.05, 0.05, distance, 8)
      const belt = new THREE.Mesh(beltGeometry, beltMaterial)
      
      const midX = (point.x + nextPoint.x) / 2
      const midZ = (point.z + nextPoint.z) / 2
      belt.position.set(midX, 1.2, midZ)
      
      const angle = Math.atan2(nextPoint.x - point.x, nextPoint.z - point.z)
      belt.rotation.x = Math.PI / 2
      belt.rotation.z = -angle
      
      belt.userData = { type: 'queue', name: '排队栏', selectable: true }
      group.add(belt)
    }
  }

  const floorGeometry = new THREE.PlaneGeometry(40, 25)
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.9,
    transparent: true,
    opacity: 0.5
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(-8, 0.01, 10)
  floor.receiveShadow = true
  floor.userData = { type: 'queue', name: '排队区地面', selectable: false }
  group.add(floor)

  return group
}

function createScreens(screensData) {
  const group = new THREE.Group()
  group.name = 'screens'

  screensData.forEach((screen, index) => {
    const screenGroup = new THREE.Group()
    screenGroup.name = `screen_${index}`

    const standGeometry = new THREE.BoxGeometry(0.5, 3, 0.5)
    const standMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      metalness: 0.8,
      roughness: 0.2
    })
    const stand = new THREE.Mesh(standGeometry, standMaterial)
    stand.position.set(screen.position.x, 1.5, screen.position.z)
    stand.castShadow = true
    stand.userData = { type: 'screen', name: screen.name, selectable: true, screenData: screen, draggable: true }
    screenGroup.add(stand)

    const screenGeometry = new THREE.PlaneGeometry(screen.width, screen.height)
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide
    })
    const screenMesh = new THREE.Mesh(screenGeometry, screenMaterial)
    screenMesh.position.set(
      screen.position.x,
      screen.height / 2 + 2,
      screen.position.z
    )
    screenMesh.rotation.y = screen.rotation || 0
    screenMesh.castShadow = true
    screenMesh.userData = { type: 'screen', name: screen.name, selectable: true, screenData: screen, draggable: true }
    screenGroup.add(screenMesh)

    const borderGeometry = new THREE.BoxGeometry(screen.width + 0.2, screen.height + 0.2, 0.1)
    const borderMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d3748,
      metalness: 0.7,
      roughness: 0.3
    })
    const border = new THREE.Mesh(borderGeometry, borderMaterial)
    border.position.copy(screenMesh.position)
    border.position.z += 0.05
    border.rotation.y = screen.rotation || 0
    border.userData = { type: 'screen', name: screen.name, selectable: true, screenData: screen, draggable: true }
    screenGroup.add(border)

    group.add(screenGroup)
  })

  return group
}

function createObstacles(obstaclesData) {
  const group = new THREE.Group()
  group.name = 'obstacles'

  obstaclesData.forEach((obstacle, index) => {
    let mesh
    
    if (obstacle.shape === 'box') {
      const geometry = new THREE.BoxGeometry(
        obstacle.width,
        obstacle.height,
        obstacle.depth
      )
      const material = new THREE.MeshStandardMaterial({
        color: obstacle.color || 0x8b5cf6,
        transparent: true,
        opacity: 0.8,
        metalness: 0.3,
        roughness: 0.7
      })
      mesh = new THREE.Mesh(geometry, material)
    } else if (obstacle.shape === 'cylinder') {
      const geometry = new THREE.CylinderGeometry(
        obstacle.radius,
        obstacle.radius,
        obstacle.height,
        16
      )
      const material = new THREE.MeshStandardMaterial({
        color: obstacle.color || 0x8b5cf6,
        transparent: true,
        opacity: 0.8,
        metalness: 0.3,
        roughness: 0.7
      })
      mesh = new THREE.Mesh(geometry, material)
    }

    if (mesh) {
      mesh.position.set(
        obstacle.position.x,
        obstacle.height / 2,
        obstacle.position.z
      )
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { 
        type: 'obstacle', 
        name: obstacle.name, 
        selectable: true,
        obstacleData: obstacle,
        draggable: true
      }
      group.add(mesh)
    }
  })

  return group
}

function createViewpoints(viewpointsData) {
  const group = new THREE.Group()
  group.name = 'viewpoints'

  viewpointsData.forEach((vp, index) => {
    const vpGroup = new THREE.Group()
    vpGroup.name = `viewpoint_${index}`

    const bodyGeometry = new THREE.CylinderGeometry(0.2, 0.25, 1.2, 12)
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      metalness: 0.4,
      roughness: 0.6
    })
    const eyeHeight = vp.eyeHeight || 1.6
    const bodyHeight = eyeHeight - 0.4
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.set(vp.position.x, bodyHeight / 2, vp.position.z)
    body.castShadow = true
    body.userData = { type: 'viewpoint', name: vp.name, selectable: true, viewpointData: vp, index, draggable: true }
    vpGroup.add(body)

    const headGeometry = new THREE.SphereGeometry(0.2, 16, 16)
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      metalness: 0.3,
      roughness: 0.7
    })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.set(vp.position.x, eyeHeight, vp.position.z)
    head.castShadow = true
    head.userData = { type: 'viewpoint', name: vp.name, selectable: true, viewpointData: vp, index, draggable: true }
    vpGroup.add(head)

    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8)
    const eyeMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      emissive: 0x1a202c,
      emissiveIntensity: 0.5
    })
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    leftEye.position.set(vp.position.x - 0.08, eyeHeight + 0.02, vp.position.z + 0.15)
    leftEye.userData = { type: 'viewpoint', name: vp.name, selectable: false, viewpointData: vp, index }
    vpGroup.add(leftEye)

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    rightEye.position.set(vp.position.x + 0.08, eyeHeight + 0.02, vp.position.z + 0.15)
    rightEye.userData = { type: 'viewpoint', name: vp.name, selectable: false, viewpointData: vp, index }
    vpGroup.add(rightEye)

    vpGroup.userData = { viewpointData: vp, index }
    group.add(vpGroup)
  })

  return group
}
