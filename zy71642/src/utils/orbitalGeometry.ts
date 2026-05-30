import * as THREE from 'three'
import type { OrbitalShape } from '@/data/molecules'

const GRID_SIZE = 40
const GRID_RANGE = 2.5
const THRESHOLD = 0.35

function gaussianLobe(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  cz: number,
  sx: number,
  sy: number,
  sz: number
): number {
  const dx = (x - cx) / sx
  const dy = (y - cy) / sy
  const dz = (z - cz) / sz
  return Math.exp(-(dx * dx + dy * dy + dz * dz) * 2)
}

export function generateOrbitalField(shape: OrbitalShape): Float32Array {
  const size = GRID_SIZE
  const range = GRID_RANGE
  const step = (2 * range) / (size - 1)
  const totalCells = size * size * size
  const field = new Float32Array(totalCells)

  for (let ix = 0; ix < size; ix++) {
    for (let iy = 0; iy < size; iy++) {
      for (let iz = 0; iz < size; iz++) {
        const x = -range + ix * step
        const y = -range + iy * step
        const z = -range + iz * step
        let value = 0

        for (const lobe of shape.lobes) {
          const [cx, cy, cz] = lobe.center
          const [sx, sy, sz] = lobe.scale
          const g = gaussianLobe(x, y, z, cx, cy, cz, sx, sy, sz)
          value += lobe.phase * g
        }

        field[ix * size * size + iy * size + iz] = value
      }
    }
  }

  return field
}

interface MarchingCubesResult {
  positions: number[]
  normals: number[]
  colors: number[]
}

const EDGE_TABLE = new Int32Array(256)
const TRI_TABLE: number[][] = []

function initMarchingCubesTables() {
  for (let i = 0; i < 256; i++) {
    let edges = 0
    for (let j = 0; j < 8; j++) {
      if (i & (1 << j)) edges |= (1 << j)
    }
    EDGE_TABLE[i] = edges
  }

  for (let i = 0; i < 256; i++) {
    TRI_TABLE[i] = []
  }

  TRI_TABLE[0] = []
  TRI_TABLE[1] = [0, 8, 3]
  TRI_TABLE[2] = [0, 1, 9]
  TRI_TABLE[3] = [1, 8, 3, 9, 8, 1]
  TRI_TABLE[4] = [1, 2, 10]
  TRI_TABLE[5] = [0, 8, 3, 1, 2, 10]
  TRI_TABLE[6] = [9, 2, 10, 0, 2, 9]
  TRI_TABLE[7] = [2, 8, 3, 2, 10, 8, 10, 9, 8]
  TRI_TABLE[8] = [3, 11, 2]
  TRI_TABLE[9] = [0, 11, 2, 8, 11, 0]
  TRI_TABLE[10] = [1, 9, 0, 2, 3, 11]
  TRI_TABLE[11] = [1, 11, 2, 1, 9, 11, 9, 8, 11]
  TRI_TABLE[12] = [3, 10, 1, 11, 10, 3]
  TRI_TABLE[13] = [0, 10, 1, 0, 8, 10, 8, 11, 10]
  TRI_TABLE[14] = [3, 9, 0, 3, 11, 9, 11, 10, 9]
  TRI_TABLE[15] = [9, 8, 10, 10, 8, 11]

  for (let i = 16; i < 256; i++) {
    const base = i & 15
    if (TRI_TABLE[base].length > 0) {
      TRI_TABLE[i] = [...TRI_TABLE[base]]
    }
  }
}

initMarchingCubesTables()

function vertexInterp(
  isolevel: number,
  p1: [number, number, number],
  p2: [number, number, number],
  v1: number,
  v2: number
): [number, number, number] {
  if (Math.abs(v2 - v1) < 0.00001) return p1
  const t = (isolevel - v1) / (v2 - v1)
  return [
    p1[0] + t * (p2[0] - p1[0]),
    p1[1] + t * (p2[1] - p1[1]),
    p1[2] + t * (p2[2] - p1[2]),
  ]
}

export function marchingCubes(
  field: Float32Array,
  gridSize: number,
  range: number,
  threshold: number,
  posColor: [number, number, number],
  negColor: [number, number, number]
): MarchingCubesResult {
  const size = gridSize
  const step = (2 * range) / (size - 1)
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []

  function getField(ix: number, iy: number, iz: number): number {
    if (ix < 0 || ix >= size || iy < 0 || iy >= size || iz < 0 || iz >= size) return 0
    return field[ix * size * size + iy * size + iz]
  }

  function getPos(ix: number, iy: number, iz: number): [number, number, number] {
    return [-range + ix * step, -range + iy * step, -range + iz * step]
  }

  for (let ix = 0; ix < size - 1; ix++) {
    for (let iy = 0; iy < size - 1; iy++) {
      for (let iz = 0; iz < size - 1; iz++) {
        const v = [
          getField(ix, iy, iz + 1),
          getField(ix + 1, iy, iz + 1),
          getField(ix + 1, iy, iz),
          getField(ix, iy, iz),
          getField(ix, iy + 1, iz + 1),
          getField(ix + 1, iy + 1, iz + 1),
          getField(ix + 1, iy + 1, iz),
          getField(ix, iy + 1, iz),
        ]

        let cubeIndex = 0
        for (let i = 0; i < 8; i++) {
          if (v[i] > threshold || v[i] < -threshold) {
            if (Math.abs(v[i]) > threshold) cubeIndex |= (1 << i)
          }
        }

        const p = [
          getPos(ix, iy, iz + 1),
          getPos(ix + 1, iy, iz + 1),
          getPos(ix + 1, iy, iz),
          getPos(ix, iy, iz),
          getPos(ix, iy + 1, iz + 1),
          getPos(ix + 1, iy + 1, iz + 1),
          getPos(ix + 1, iy + 1, iz),
          getPos(ix, iy + 1, iz),
        ]

        const absV = v.map(Math.abs)
        let ci = 0
        for (let i = 0; i < 8; i++) {
          if (absV[i] > threshold) ci |= (1 << i)
        }

        if (ci === 0 || ci === 255) continue

        const edgeVertices: ([number, number, number] | null)[] = new Array(12).fill(null)

        const edgePairs: [number, number][] = [
          [0, 1], [1, 2], [2, 3], [3, 0],
          [4, 5], [5, 6], [6, 7], [7, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
        ]

        for (let e = 0; e < 12; e++) {
          const [a, b] = edgePairs[e]
          if ((absV[a] > threshold) !== (absV[b] > threshold)) {
            edgeVertices[e] = vertexInterp(threshold, p[a], p[b], absV[a], absV[b])
          }
        }

        const triEdges = TRI_TABLE[ci]
        for (let t = 0; t < triEdges.length; t += 3) {
          const e0 = triEdges[t]
          const e1 = triEdges[t + 1]
          const e2 = triEdges[t + 2]
          if (e0 === undefined || e1 === undefined || e2 === undefined) continue
          const v0 = edgeVertices[e0]
          const v1 = edgeVertices[e1]
          const v2 = edgeVertices[e2]
          if (!v0 || !v1 || !v2) continue

          positions.push(v0[0], v0[1], v0[2])
          positions.push(v1[0], v1[1], v1[2])
          positions.push(v2[0], v2[1], v2[2])

          const avgX = (v0[0] + v1[0] + v2[0]) / 3
          const avgY = (v0[1] + v1[1] + v2[1]) / 3
          const avgZ = (v0[2] + v1[2] + v2[2]) / 3

          const gix = Math.round((avgX + range) / step)
          const giy = Math.round((avgY + range) / step)
          const giz = Math.round((avgZ + range) / step)
          const fieldVal = getField(gix, giy, giz)
          const isPositive = fieldVal >= 0
          const col = isPositive ? posColor : negColor

          for (let vi = 0; vi < 3; vi++) {
            const nx = avgX * 0.1
            const ny = avgY * 0.1
            const nz = avgZ * 0.1
            normals.push(nx, ny, nz)
            colors.push(col[0], col[1], col[2])
          }
        }
      }
    }
  }

  return { positions, normals, colors }
}

export function generateOrbitalGeometry(
  shape: OrbitalShape,
  threshold: number = THRESHOLD
): THREE.BufferGeometry | null {
  const field = generateOrbitalField(shape)

  const posColor: [number, number, number] = [0, 1, 0.83]
  const negColor: [number, number, number] = [1, 0.62, 0.11]

  const result = marchingCubes(field, GRID_SIZE, GRID_RANGE, threshold, posColor, negColor)

  if (result.positions.length === 0) return null

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(result.positions, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(result.normals, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(result.colors, 3))
  geometry.computeVertexNormals()

  return geometry
}

export function generateSectionCanvas(
  shape: OrbitalShape,
  axis: 'x' | 'y' | 'z',
  position: number,
  width: number = 200,
  height: number = 200
): string {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const range = GRID_RANGE
  const step = (2 * range) / width

  const imageData = ctx.createImageData(width, height)

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let x: number, y: number, z: number

      if (axis === 'x') {
        x = position
        y = -range + px * step
        z = -range + (height - 1 - py) * step
      } else if (axis === 'y') {
        x = -range + px * step
        y = position
        z = -range + (height - 1 - py) * step
      } else {
        x = -range + px * step
        y = -range + (height - 1 - py) * step
        z = position
      }

      let value = 0
      for (const lobe of shape.lobes) {
        const [cx, cy, cz] = lobe.center
        const [sx, sy, sz] = lobe.scale
        const g = gaussianLobe(x, y, z, cx, cy, cz, sx, sy, sz)
        value += lobe.phase * g
      }

      const idx = (py * width + px) * 4
      const absVal = Math.abs(value)
      const intensity = Math.min(1, absVal * 3)

      if (value > 0.01) {
        imageData.data[idx] = Math.round(0 * (1 - intensity) + 0 * intensity)
        imageData.data[idx + 1] = Math.round(255 * intensity)
        imageData.data[idx + 2] = Math.round(213 * intensity)
        imageData.data[idx + 3] = Math.round(intensity * 200)
      } else if (value < -0.01) {
        imageData.data[idx] = Math.round(255 * intensity)
        imageData.data[idx + 1] = Math.round(159 * intensity)
        imageData.data[idx + 2] = Math.round(28 * intensity)
        imageData.data[idx + 3] = Math.round(intensity * 200)
      } else {
        imageData.data[idx] = 10
        imageData.data[idx + 1] = 14
        imageData.data[idx + 2] = 26
        imageData.data[idx + 3] = 255
      }
    }
  }

  ctx.putImageData(imageData, 0, 0)

  ctx.strokeStyle = 'rgba(42, 48, 80, 0.5)'
  ctx.lineWidth = 0.5
  const gridStep = width / 10
  for (let i = 0; i <= 10; i++) {
    ctx.beginPath()
    ctx.moveTo(i * gridStep, 0)
    ctx.lineTo(i * gridStep, height)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(0, i * gridStep)
    ctx.lineTo(width, i * gridStep)
    ctx.stroke()
  }

  return canvas.toDataURL()
}
