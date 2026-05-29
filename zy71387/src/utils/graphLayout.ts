export interface GraphNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  fx?: number
  fy?: number
}

export interface GraphEdge {
  source: string
  target: string
}

export function forceLayout(
  nodeIds: string[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 120
): Map<string, { x: number; y: number }> {
  const nodes = new Map<string, GraphNode>()
  const centerX = width / 2
  const centerY = height / 2

  for (const id of nodeIds) {
    const angle = Math.random() * Math.PI * 2
    const radius = Math.min(width, height) * 0.3 * Math.random()
    nodes.set(id, {
      id,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    })
  }

  const repulsionStrength = 3000
  const attractionStrength = 0.005
  const centerStrength = 0.01
  const damping = 0.9

  for (let iter = 0; iter < iterations; iter++) {
    for (const [id1, n1] of nodes) {
      for (const [id2, n2] of nodes) {
        if (id1 === id2) continue
        const dx = n2.x - n1.x
        const dy = n2.y - n1.y
        const dist = Math.sqrt(dx * dx + dy * dy) + 1
        const force = repulsionStrength / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        n1.vx -= fx
        n1.vy -= fy
        n2.vx += fx
        n2.vy += fy
      }
    }

    for (const edge of edges) {
      const n1 = nodes.get(edge.source)
      const n2 = nodes.get(edge.target)
      if (!n1 || !n2) continue
      const dx = n2.x - n1.x
      const dy = n2.y - n1.y
      const dist = Math.sqrt(dx * dx + dy * dy) + 1
      const force = dist * attractionStrength
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      n1.vx += fx
      n1.vy += fy
      n2.vx -= fx
      n2.vy -= fy
    }

    for (const [, n] of nodes) {
      n.vx += (centerX - n.x) * centerStrength
      n.vy += (centerY - n.y) * centerStrength
      n.vx *= damping
      n.vy *= damping
      if (n.fx !== undefined) {
        n.x = n.fx
        n.vx = 0
      } else {
        n.x += n.vx
      }
      if (n.fy !== undefined) {
        n.y = n.fy
        n.vy = 0
      } else {
        n.y += n.vy
      }
      n.x = Math.max(50, Math.min(width - 50, n.x))
      n.y = Math.max(50, Math.min(height - 50, n.y))
    }
  }

  const result = new Map<string, { x: number; y: number }>()
  for (const [id, n] of nodes) {
    result.set(id, { x: n.x, y: n.y })
  }
  return result
}
