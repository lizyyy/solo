import type { LightBar, HangingPoint, Fixture, ActorRoute, Collision, Vector3 } from "@/types"

function vec3Distance(a: Vector3, b: Vector3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

function lineSegmentPointDistance(
  segStart: Vector3,
  segEnd: Vector3,
  point: Vector3,
): number {
  const dx = segEnd.x - segStart.x
  const dy = segEnd.y - segStart.y
  const dz = segEnd.z - segStart.z
  const lenSq = dx * dx + dy * dy + dz * dz
  if (lenSq === 0) return vec3Distance(segStart, point)
  let t =
    ((point.x - segStart.x) * dx +
      (point.y - segStart.y) * dy +
      (point.z - segStart.z) * dz) /
    lenSq
  t = Math.max(0, Math.min(1, t))
  const proj: Vector3 = {
    x: segStart.x + t * dx,
    y: segStart.y + t * dy,
    z: segStart.z + t * dz,
  }
  return vec3Distance(proj, point)
}

function getLightBarBounds(bar: LightBar): { min: Vector3; max: Vector3 } {
  const halfLen = bar.length / 2
  return {
    min: {
      x: bar.position.x - halfLen,
      y: bar.position.y - 0.15,
      z: bar.position.z - 0.15,
    },
    max: {
      x: bar.position.x + halfLen,
      y: bar.position.y + 0.15,
      z: bar.position.z + 0.15,
    },
  }
}

function rayIntersectsBox(
  origin: Vector3,
  direction: Vector3,
  boxMin: Vector3,
  boxMax: Vector3,
): boolean {
  let tmin = -Infinity
  let tmax = Infinity
  const axes: ("x" | "y" | "z")[] = ["x", "y", "z"]
  for (const axis of axes) {
    if (Math.abs(direction[axis]) < 1e-8) {
      if (origin[axis] < boxMin[axis] || origin[axis] > boxMax[axis]) return false
    } else {
      let t1 = (boxMin[axis] - origin[axis]) / direction[axis]
      let t2 = (boxMax[axis] - origin[axis]) / direction[axis]
      if (t1 > t2) {
        const tmp = t1
        t1 = t2
        t2 = tmp
      }
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) return false
    }
  }
  return tmax > 0.01
}

function normalize(v: Vector3): Vector3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z)
  if (len === 0) return { x: 0, y: 0, z: 0 }
  return { x: v.x / len, y: v.y / len, z: v.z / len }
}

export function detectViewObstructions(
  fixtures: Fixture[],
  lightBars: LightBar[],
): Collision[] {
  const collisions: Collision[] = []

  for (const fixture of fixtures) {
    const dir = normalize({
      x: fixture.targetPosition.x - fixture.position.x,
      y: fixture.targetPosition.y - fixture.position.y,
      z: fixture.targetPosition.z - fixture.position.z,
    })

    for (const bar of lightBars) {
      if (fixture.attachedTo === bar.id) continue

      const bounds = getLightBarBounds(bar)
      const fixtureDistToBar = vec3Distance(fixture.position, bar.position)

      if (fixtureDistToBar > vec3Distance(fixture.position, fixture.targetPosition))
        continue

      if (rayIntersectsBox(fixture.position, dir, bounds.min, bounds.max)) {
        collisions.push({
          id: `col-vo-${fixture.id}-${bar.id}`,
          type: "view_obstruction",
          severity: "critical",
          involvedElements: [fixture.id, bar.id],
          description: `${fixture.name}的光束被${bar.name}遮挡，观众区可能出现阴影或穿帮`,
          position: {
            x: (fixture.position.x + bar.position.x) / 2,
            y: (fixture.position.y + bar.position.y) / 2,
            z: (fixture.position.z + bar.position.z) / 2,
          },
          resolved: false,
        })
      }
    }
  }

  return collisions
}

export function detectOverloads(
  hangingPoints: HangingPoint[],
  fixtures: Fixture[],
): Collision[] {
  const collisions: Collision[] = []

  for (const hp of hangingPoints) {
    const attachedFixtures = fixtures.filter((f) => {
      const dist = vec3Distance(f.position, hp.position)
      return dist < 3 && f.position.y >= hp.position.y - 1
    })

    const totalWeight = attachedFixtures.reduce((sum, f) => sum + f.weight, 0)
    const loadRatio = totalWeight / hp.loadCapacity

    if (loadRatio > 0.8) {
      const severity: "warning" | "critical" = loadRatio > 1.0 ? "critical" : "warning"
      const pctStr = (loadRatio * 100).toFixed(1)
      collisions.push({
        id: `col-ol-${hp.id}`,
        type: "overload",
        severity,
        involvedElements: [hp.id, ...attachedFixtures.map((f) => f.id)],
        description: `${hp.name}挂载${attachedFixtures.length}台灯具总重${totalWeight}kg，额定承重${hp.loadCapacity}kg，超载率${pctStr}%`,
        position: { ...hp.position },
        resolved: false,
      })
    }
  }

  return collisions
}

export function detectRouteCollisions(
  actorRoutes: ActorRoute[],
  lightBars: LightBar[],
  hangingPoints: HangingPoint[],
): Collision[] {
  const collisions: Collision[] = []

  for (const route of actorRoutes) {
    for (let i = 0; i < route.waypoints.length - 1; i++) {
      const start = route.waypoints[i]
      const end = route.waypoints[i + 1]
      const segLen = vec3Distance(start, end)
      const steps = Math.max(2, Math.ceil(segLen / 0.5))

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const point: Vector3 = {
          x: start.x + (end.x - start.x) * t,
          y: route.actorHeight,
          z: start.z + (end.z - start.z) * t,
        }

        for (const bar of lightBars) {
          const dist = lineSegmentPointDistance(
            { x: bar.position.x - bar.length / 2, y: bar.position.y, z: bar.position.z },
            { x: bar.position.x + bar.length / 2, y: bar.position.y, z: bar.position.z },
            { x: point.x, y: bar.position.y, z: point.z },
          )

          const clearance = bar.position.y - point.y
          const horizontalDist = dist

          if (horizontalDist < 1.0 && clearance < 2.5) {
            const existingCollision = collisions.find(
              (c) =>
                c.type === "route_collision" &&
                c.involvedElements.includes(route.id) &&
                c.involvedElements.includes(bar.id),
            )
            if (!existingCollision) {
              const severity: "warning" | "critical" = clearance < 2.2 ? "critical" : "warning"
              collisions.push({
                id: `col-rc-${route.id}-${bar.id}`,
                type: "route_collision",
                severity,
                involvedElements: [route.id, bar.id],
                description: `${route.name}（${route.scene}）路线与${bar.name}吊挂区域空间交叉，净空高度${clearance.toFixed(1)}m`,
                position: { ...point, y: (point.y + bar.position.y) / 2 },
                resolved: false,
              })
            }
          }
        }

        for (const hp of hangingPoints) {
          const dist = vec3Distance(
            { x: point.x, y: hp.position.y, z: point.z },
            hp.position,
          )
          const clearance = hp.position.y - point.y

          if (dist < 1.5 && clearance < 2.5) {
            const existingCollision = collisions.find(
              (c) =>
                c.type === "route_collision" &&
                c.involvedElements.includes(route.id) &&
                c.involvedElements.includes(hp.id),
            )
            if (!existingCollision) {
              const severity: "warning" | "critical" = clearance < 2.2 ? "critical" : "warning"
              collisions.push({
                id: `col-rc-${route.id}-${hp.id}`,
                type: "route_collision",
                severity,
                involvedElements: [route.id, hp.id],
                description: `${route.name}（${route.scene}）路线与${hp.name}空间交叉，净空高度${clearance.toFixed(1)}m`,
                position: { ...point, y: (point.y + hp.position.y) / 2 },
                resolved: false,
              })
            }
          }
        }
      }
    }
  }

  return collisions
}

export function runAllDetections(
  lightBars: LightBar[],
  hangingPoints: HangingPoint[],
  fixtures: Fixture[],
  actorRoutes: ActorRoute[],
): Collision[] {
  return [
    ...detectViewObstructions(fixtures, lightBars),
    ...detectOverloads(hangingPoints, fixtures),
    ...detectRouteCollisions(actorRoutes, lightBars, hangingPoints),
  ]
}
