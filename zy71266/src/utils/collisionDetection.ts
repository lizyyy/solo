import * as THREE from 'three'
import type { Light, Prop, Actor, OcclusionResult, ActorLightStatus, Trajectory } from '@/types'

export function detectOcclusions(
  lights: Light[],
  props: Prop[]
): OcclusionResult[] {
  const results: OcclusionResult[] = []
  const raycaster = new THREE.Raycaster()

  const propMeshes = props.filter((p) => p.occluder).map((prop) => {
    let geometry: THREE.BufferGeometry
    switch (prop.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(1, 16, 16)
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(1, 1, 1, 16)
        break
      case 'plane':
        geometry = new THREE.PlaneGeometry(1, 1)
        break
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1)
    }
    const mesh = new THREE.Mesh(geometry)
    mesh.position.set(prop.positionX, prop.positionY, prop.positionZ)
    mesh.rotation.set(
      (prop.rotationX * Math.PI) / 180,
      (prop.rotationY * Math.PI) / 180,
      (prop.rotationZ * Math.PI) / 180
    )
    mesh.scale.set(prop.scaleX, prop.scaleY, prop.scaleZ)
    mesh.updateMatrixWorld()
    return { mesh, propId: prop.id }
  })

  lights.forEach((light) => {
    const lightPos = new THREE.Vector3(light.positionX, light.positionY, light.positionZ)
    const targetPos = new THREE.Vector3(light.targetX, light.targetY, light.targetZ)
    const direction = targetPos.clone().sub(lightPos).normalize()
    const distance = lightPos.distanceTo(targetPos)

    raycaster.set(lightPos, direction)
    raycaster.far = distance

    const meshes = propMeshes.map((p) => p.mesh)
    const intersects = raycaster.intersectObjects(meshes)

    if (intersects.length > 0) {
      const hit = intersects[0]
      const hitProp = propMeshes.find((p) => p.mesh === hit.object)
      if (hitProp) {
        results.push({
          lightId: light.id,
          propId: hitProp.propId,
          intersectionPoint: {
            x: hit.point.x,
            y: hit.point.y,
            z: hit.point.z,
          },
        })
      }
    }
  })

  propMeshes.forEach((p) => {
    p.mesh.geometry.dispose()
  })

  return results
}

export function checkActorLighting(
  actors: Actor[],
  lights: Light[],
  trajectories: Trajectory[],
  currentTime: number
): ActorLightStatus[] {
  const results: ActorLightStatus[] = []

  actors.forEach((actor) => {
    const trajectory = trajectories.find((t) => t.actorId === actor.id)
    let actorPos = { x: 0, y: actor.height / 2, z: 0 }

    if (trajectory && trajectory.waypoints.length > 0) {
      const waypoints = [...trajectory.waypoints].sort((a, b) => a.time - b.time)

      if (currentTime <= waypoints[0].time) {
        actorPos = { x: waypoints[0].x, y: waypoints[0].y + actor.height / 2, z: waypoints[0].z }
      } else if (currentTime >= waypoints[waypoints.length - 1].time) {
        actorPos = {
          x: waypoints[waypoints.length - 1].x,
          y: waypoints[waypoints.length - 1].y + actor.height / 2,
          z: waypoints[waypoints.length - 1].z,
        }
      } else {
        for (let i = 0; i < waypoints.length - 1; i++) {
          if (currentTime >= waypoints[i].time && currentTime <= waypoints[i + 1].time) {
            const t =
              (currentTime - waypoints[i].time) / (waypoints[i + 1].time - waypoints[i].time)
            actorPos = {
              x: waypoints[i].x + t * (waypoints[i + 1].x - waypoints[i].x),
              y: waypoints[i].y + t * (waypoints[i + 1].y - waypoints[i].y) + actor.height / 2,
              z: waypoints[i].z + t * (waypoints[i + 1].z - waypoints[i].z),
            }
            break
          }
        }
      }
    }

    const illuminatingLights: string[] = []

    lights.forEach((light) => {
      if (isPointInLightCone(actorPos, light)) {
        illuminatingLights.push(light.id)
      }
    })

    results.push({
      actorId: actor.id,
      inLightCone: illuminatingLights.length > 0,
      illuminatingLights,
    })
  })

  return results
}

function isPointInLightCone(
  point: { x: number; y: number; z: number },
  light: Light
): boolean {
  const lightPos = new THREE.Vector3(light.positionX, light.positionY, light.positionZ)
  const targetPos = new THREE.Vector3(light.targetX, light.targetY, light.targetZ)
  const pointPos = new THREE.Vector3(point.x, point.y, point.z)

  const lightDirection = targetPos.clone().sub(lightPos).normalize()
  const pointDirection = pointPos.clone().sub(lightPos)

  const distance = pointDirection.length()
  pointDirection.normalize()

  const dot = lightDirection.dot(pointDirection)
  const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI)

  const halfAngle = light.angle / 2

  const maxDistance = lightPos.distanceTo(targetPos) * 1.5

  return angle <= halfAngle && distance <= maxDistance
}

export function interpolateActorPosition(
  trajectory: Trajectory,
  currentTime: number,
  actorHeight: number = 1.7
): { x: number; y: number; z: number } {
  if (!trajectory.waypoints || trajectory.waypoints.length === 0) {
    return { x: 0, y: actorHeight / 2, z: 0 }
  }

  const waypoints = [...trajectory.waypoints].sort((a, b) => a.time - b.time)

  if (currentTime <= waypoints[0].time) {
    return { x: waypoints[0].x, y: waypoints[0].y + actorHeight / 2, z: waypoints[0].z }
  }

  if (currentTime >= waypoints[waypoints.length - 1].time) {
    return {
      x: waypoints[waypoints.length - 1].x,
      y: waypoints[waypoints.length - 1].y + actorHeight / 2,
      z: waypoints[waypoints.length - 1].z,
    }
  }

  for (let i = 0; i < waypoints.length - 1; i++) {
    if (currentTime >= waypoints[i].time && currentTime <= waypoints[i + 1].time) {
      const t = (currentTime - waypoints[i].time) / (waypoints[i + 1].time - waypoints[i].time)
      return {
        x: waypoints[i].x + t * (waypoints[i + 1].x - waypoints[i].x),
        y: waypoints[i].y + t * (waypoints[i + 1].y - waypoints[i].y) + actorHeight / 2,
        z: waypoints[i].z + t * (waypoints[i + 1].z - waypoints[i].z),
      }
    }
  }

  return { x: 0, y: actorHeight / 2, z: 0 }
}
