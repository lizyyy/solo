import type { Light, Actor, Prop, Trajectory, ValidationResult } from '@/types'

interface ParsedData {
  lights: Light[]
  actors: Actor[]
  props: Prop[]
  trajectories: Trajectory[]
  validations: ValidationResult[]
}

export function parseDataFile(content: string, fileName: string): ParsedData {
  const result: ParsedData = {
    lights: [],
    actors: [],
    props: [],
    trajectories: [],
    validations: [],
  }

  const lines = content.split('\n')

  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    return parseJsonData(content, fileName)
  }

  return parseTextData(lines, fileName)
}

function parseJsonData(content: string, fileName: string): ParsedData {
  const result: ParsedData = {
    lights: [],
    actors: [],
    props: [],
    trajectories: [],
    validations: [],
  }

  try {
    const data = JSON.parse(content)

    if (data.lights && Array.isArray(data.lights)) {
      data.lights.forEach((light: Partial<Light>, index: number) => {
        const validated = validateLight(light, fileName, index + 1)
        if (validated.data) {
          result.lights.push(validated.data)
        }
        result.validations.push(...validated.validations)
      })
    }

    if (data.actors && Array.isArray(data.actors)) {
      data.actors.forEach((actor: Partial<Actor>, index: number) => {
        const validated = validateActor(actor, fileName, index + 1)
        if (validated.data) {
          result.actors.push(validated.data)
        }
        result.validations.push(...validated.validations)
      })
    }

    if (data.props && Array.isArray(data.props)) {
      data.props.forEach((prop: Partial<Prop>, index: number) => {
        const validated = validateProp(prop, fileName, index + 1)
        if (validated.data) {
          result.props.push(validated.data)
        }
        result.validations.push(...validated.validations)
      })
    }

    if (data.trajectories && Array.isArray(data.trajectories)) {
      data.trajectories.forEach((traj: Partial<Trajectory>, index: number) => {
        const validated = validateTrajectory(traj, fileName, index + 1)
        if (validated.data) {
          result.trajectories.push(validated.data)
        }
        result.validations.push(...validated.validations)
      })
    }
  } catch (e) {
    result.validations.push({
      id: crypto.randomUUID(),
      severity: 'error',
      type: 'PARSE_ERROR',
      message: `JSON解析失败: ${(e as Error).message}`,
      sourceFile: fileName,
      sourceLine: 1,
    })
  }

  return result
}

function normalizeSection(section: string): string {
  const s = section.toLowerCase()
  if (s === 'lights') return 'light'
  if (s === 'actors') return 'actor'
  if (s === 'props') return 'prop'
  if (s === 'trajectories') return 'trajectory'
  return s
}

function saveCurrentTrajectory(
  trajectory: Partial<Trajectory> | null,
  fileName: string,
  result: ParsedData
) {
  if (trajectory && trajectory.waypoints && trajectory.waypoints.length > 0) {
    const validated = validateTrajectory(trajectory, fileName, trajectory.sourceLine || 1)
    if (validated.data) {
      result.trajectories.push(validated.data)
    }
    result.validations.push(...validated.validations)
  }
}

function parseTextData(lines: string[], fileName: string): ParsedData {
  const result: ParsedData = {
    lights: [],
    actors: [],
    props: [],
    trajectories: [],
    validations: [],
  }

  let currentSection: string | null = null
  let currentTrajectory: Partial<Trajectory> | null = null

  lines.forEach((line, index) => {
    const lineNum = index + 1
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) return

    if (trimmed.startsWith('[')) {
      const sectionMatch = trimmed.match(/\[(\w+)\]/)
      if (sectionMatch) {
        const rawSection = sectionMatch[1]
        currentSection = normalizeSection(rawSection)
        if (currentSection === 'trajectory') {
          saveCurrentTrajectory(currentTrajectory, fileName, result)
          currentTrajectory = {
            id: crypto.randomUUID(),
            name: `Trajectory_${lineNum}`,
            waypoints: [],
            sourceFile: fileName,
            sourceLine: lineNum,
          }
        }
      }
      return
    }

    switch (currentSection) {
      case 'light':
        parseLightLine(trimmed, fileName, lineNum, result)
        break
      case 'actor':
        parseActorLine(trimmed, fileName, lineNum, result)
        break
      case 'prop':
        parsePropLine(trimmed, fileName, lineNum, result)
        break
      case 'trajectory':
        if (currentTrajectory) {
          parseTrajectoryLine(trimmed, fileName, lineNum, currentTrajectory, result)
        }
        break
      default:
        const lowerTrimmed = trimmed.toLowerCase()
        if (lowerTrimmed.includes('light')) {
          currentSection = 'light'
        } else if (lowerTrimmed.includes('actor')) {
          currentSection = 'actor'
        } else if (lowerTrimmed.includes('prop')) {
          currentSection = 'prop'
        } else if (lowerTrimmed.includes('trajectory')) {
          saveCurrentTrajectory(currentTrajectory, fileName, result)
          currentSection = 'trajectory'
          currentTrajectory = {
            id: crypto.randomUUID(),
            name: `Trajectory_${lineNum}`,
            waypoints: [],
            sourceFile: fileName,
            sourceLine: lineNum,
          }
        }
    }
  })

  saveCurrentTrajectory(currentTrajectory, fileName, result)

  return result
}

function parseLightLine(line: string, fileName: string, lineNum: number, result: ParsedData) {
  const parts = line.split(/[,\s]+/).filter(Boolean)
  const light: Partial<Light> = {
    id: crypto.randomUUID(),
    sourceFile: fileName,
    sourceLine: lineNum,
    type: 'spot',
    name: `Light_${lineNum}`,
  }

  parts.forEach((part) => {
    const [key, value] = part.split('=')
    if (!key || !value) return
    const k = key.toLowerCase()
    if (k === 'name') light.name = value
    else if (k === 'type') light.type = value as Light['type']
    else if (k === 'px' || k === 'x') light.positionX = parseFloat(value)
    else if (k === 'py' || k === 'y') light.positionY = parseFloat(value)
    else if (k === 'pz' || k === 'z') light.positionZ = parseFloat(value)
    else if (k === 'tx') light.targetX = parseFloat(value)
    else if (k === 'ty') light.targetY = parseFloat(value)
    else if (k === 'tz') light.targetZ = parseFloat(value)
    else if (k === 'colortemp' || k === 'ct') light.colorTemp = parseInt(value)
    else if (k === 'intensity' || k === 'i') light.intensity = parseFloat(value)
    else if (k === 'angle' || k === 'a') light.angle = parseFloat(value)
    else if (k === 'penumbra' || k === 'p') light.penumbra = parseFloat(value)
  })

  const validated = validateLight(light, fileName, lineNum)
  if (validated.data) {
    result.lights.push(validated.data)
  }
  result.validations.push(...validated.validations)
}

function parseActorLine(line: string, fileName: string, lineNum: number, result: ParsedData) {
  const parts = line.split(/[,\s]+/).filter(Boolean)
  const actor: Partial<Actor> = {
    id: crypto.randomUUID(),
    sourceFile: fileName,
    sourceLine: lineNum,
    name: `Actor_${lineNum}`,
    height: 1.7,
    color: '#ff6b6b',
  }

  parts.forEach((part) => {
    const [key, value] = part.split('=')
    if (!key || !value) return
    const k = key.toLowerCase()
    if (k === 'name') actor.name = value
    else if (k === 'height' || k === 'h') actor.height = parseFloat(value)
    else if (k === 'color' || k === 'c') actor.color = value
  })

  const validated = validateActor(actor, fileName, lineNum)
  if (validated.data) {
    result.actors.push(validated.data)
  }
  result.validations.push(...validated.validations)
}

function parsePropLine(line: string, fileName: string, lineNum: number, result: ParsedData) {
  const parts = line.split(/[,\s]+/).filter(Boolean)
  const prop: Partial<Prop> = {
    id: crypto.randomUUID(),
    sourceFile: fileName,
    sourceLine: lineNum,
    name: `Prop_${lineNum}`,
    type: 'box',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    scaleX: 1,
    scaleY: 1,
    scaleZ: 1,
    occluder: false,
  }

  parts.forEach((part) => {
    const [key, value] = part.split('=')
    if (!key || !value) return
    const k = key.toLowerCase()
    if (k === 'name') prop.name = value
    else if (k === 'type') prop.type = value as Prop['type']
    else if (k === 'px' || k === 'x') prop.positionX = parseFloat(value)
    else if (k === 'py' || k === 'y') prop.positionY = parseFloat(value)
    else if (k === 'pz' || k === 'z') prop.positionZ = parseFloat(value)
    else if (k === 'rx') prop.rotationX = parseFloat(value)
    else if (k === 'ry') prop.rotationY = parseFloat(value)
    else if (k === 'rz') prop.rotationZ = parseFloat(value)
    else if (k === 'sx') prop.scaleX = parseFloat(value)
    else if (k === 'sy') prop.scaleY = parseFloat(value)
    else if (k === 'sz') prop.scaleZ = parseFloat(value)
    else if (k === 'occluder' || k === 'occ') prop.occluder = value === 'true' || value === '1'
  })

  const validated = validateProp(prop, fileName, lineNum)
  if (validated.data) {
    result.props.push(validated.data)
  }
  result.validations.push(...validated.validations)
}

function parseTrajectoryLine(
  line: string,
  fileName: string,
  lineNum: number,
  trajectory: Partial<Trajectory>,
  result: ParsedData
) {
  const parts = line.split(/[,\s]+/).filter(Boolean)

  parts.forEach((part) => {
    const [key, value] = part.split('=')
    if (!key || !value) return
    const k = key.toLowerCase()
    if (k === 'name') trajectory.name = value
    else if (k === 'actorid' || k === 'actor') trajectory.actorId = value
    else if (k === 'waypoint' || k === 'wp') {
      const coords = value.split(':').map(parseFloat)
      if (coords.length >= 4) {
        trajectory.waypoints?.push({
          time: coords[0],
          x: coords[1],
          y: coords[2],
          z: coords[3],
        })
      }
    }
  })

  const wpMatch = line.match(/(\d+\.?\d*):([-\d.]+):([-\d.]+):([-\d.]+)/)
  if (wpMatch) {
    trajectory.waypoints?.push({
      time: parseFloat(wpMatch[1]),
      x: parseFloat(wpMatch[2]),
      y: parseFloat(wpMatch[3]),
      z: parseFloat(wpMatch[4]),
    })
  }
}

function validateLight(
  light: Partial<Light>,
  fileName: string,
  lineNum: number
): { data: Light | null; validations: ValidationResult[] } {
  const validations: ValidationResult[] = []
  let canUse = true

  if (light.positionX === undefined || light.positionY === undefined || light.positionZ === undefined) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'error',
      type: 'LIGHT_MISSING_POSITION',
      message: `灯光 "${light.name || '未知'}" 缺少位置坐标`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: light.id,
    })
    canUse = false
  }

  if (light.colorTemp !== undefined) {
    if (light.colorTemp < 2000 || light.colorTemp > 10000) {
      validations.push({
        id: crypto.randomUUID(),
        severity: 'error',
        type: 'LIGHT_INVALID_COLORTEMP',
        message: `灯光色温 ${light.colorTemp}K 超出有效范围 (2000K-10000K)，已钳制到最近有效值`,
        sourceFile: fileName,
        sourceLine: lineNum,
        relatedElementId: light.id,
      })
      light.colorTemp = Math.max(2000, Math.min(10000, light.colorTemp))
    }
  } else {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      type: 'LIGHT_MISSING_COLORTEMP',
      message: `灯光 "${light.name || '未知'}" 缺少色温值，使用默认 5600K`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: light.id,
    })
    light.colorTemp = 5600
  }

  if (light.angle !== undefined && light.angle > 180) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      type: 'LIGHT_ANGLE_TOO_LARGE',
      message: `灯光角度 ${light.angle}° 过大，可能导致性能问题`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: light.id,
    })
  }

  if (!light.name) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'info',
      type: 'MISSING_NAME',
      message: `灯光缺少名称，已自动命名`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: light.id,
    })
  }

  const defaults: Partial<Light> = {
    targetX: light.positionX || 0,
    targetY: 0,
    targetZ: light.positionZ || 0,
    intensity: 1,
    angle: 45,
    penumbra: 0.5,
    type: 'spot',
  }

  return {
    data: canUse
      ? ({
          ...defaults,
          ...light,
        } as Light)
      : null,
    validations,
  }
}

function validateActor(
  actor: Partial<Actor>,
  fileName: string,
  lineNum: number
): { data: Actor | null; validations: ValidationResult[] } {
  const validations: ValidationResult[] = []

  if (actor.height !== undefined && actor.height <= 0) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      type: 'ACTOR_INVALID_HEIGHT',
      message: `演员 "${actor.name || '未知'}" 身高 ${actor.height} 无效，使用默认 1.7m`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: actor.id,
    })
    actor.height = 1.7
  }

  if (!actor.height) {
    actor.height = 1.7
  }

  if (!actor.name) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'info',
      type: 'MISSING_NAME',
      message: `演员缺少名称，已自动命名`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: actor.id,
    })
  }

  return {
    data: actor as Actor,
    validations,
  }
}

function validateProp(
  prop: Partial<Prop>,
  fileName: string,
  lineNum: number
): { data: Prop | null; validations: ValidationResult[] } {
  const validations: ValidationResult[] = []
  const MIN_SCALE = 0.01

  if (prop.scaleX !== undefined && prop.scaleX <= 0) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'error',
      type: 'PROP_INVALID_SCALE',
      message: `道具 "${prop.name || '未知'}" X轴缩放 ${prop.scaleX} 无效，已钳制到 ${MIN_SCALE}`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: prop.id,
    })
    prop.scaleX = MIN_SCALE
  }

  if (prop.scaleY !== undefined && prop.scaleY <= 0) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'error',
      type: 'PROP_INVALID_SCALE',
      message: `道具 "${prop.name || '未知'}" Y轴缩放 ${prop.scaleY} 无效，已钳制到 ${MIN_SCALE}`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: prop.id,
    })
    prop.scaleY = MIN_SCALE
  }

  if (prop.scaleZ !== undefined && prop.scaleZ <= 0) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'error',
      type: 'PROP_INVALID_SCALE',
      message: `道具 "${prop.name || '未知'}" Z轴缩放 ${prop.scaleZ} 无效，已钳制到 ${MIN_SCALE}`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: prop.id,
    })
    prop.scaleZ = MIN_SCALE
  }

  if (!prop.name) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'info',
      type: 'MISSING_NAME',
      message: `道具缺少名称，已自动命名`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: prop.id,
    })
  }

  return {
    data: prop as Prop,
    validations,
  }
}

function validateTrajectory(
  trajectory: Partial<Trajectory>,
  fileName: string,
  lineNum: number
): { data: Trajectory | null; validations: ValidationResult[] } {
  const validations: ValidationResult[] = []
  let isValid = true

  if (!trajectory.waypoints || trajectory.waypoints.length === 0) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'error',
      type: 'TRAJECTORY_EMPTY',
      message: `轨迹没有路径点`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: trajectory.id,
    })
    isValid = false
  } else {
    const times = trajectory.waypoints.map((w) => w.time)
    const uniqueTimes = new Set(times)
    if (times.length !== uniqueTimes.size) {
      validations.push({
        id: crypto.randomUUID(),
        severity: 'warning',
        type: 'TRAJECTORY_DUPLICATE_TIME',
        message: `轨迹存在重复的时间点`,
        sourceFile: fileName,
        sourceLine: lineNum,
        relatedElementId: trajectory.id,
      })
    }
  }

  if (!trajectory.actorId) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'warning',
      type: 'TRAJECTORY_NO_ACTOR',
      message: `轨迹没有关联的演员ID`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: trajectory.id,
    })
  }

  if (!trajectory.name) {
    validations.push({
      id: crypto.randomUUID(),
      severity: 'info',
      type: 'MISSING_NAME',
      message: `轨迹缺少名称，已自动命名`,
      sourceFile: fileName,
      sourceLine: lineNum,
      relatedElementId: trajectory.id,
    })
    trajectory.name = `Trajectory_${lineNum}`
  }

  return {
    data: isValid ? (trajectory as Trajectory) : null,
    validations,
  }
}

export function colorTempToHex(kelvin: number): string {
  const temp = kelvin / 100
  let red: number, green: number, blue: number

  if (temp <= 66) {
    red = 255
    green = Math.min(255, Math.max(0, 99.4708025861 * Math.log(temp) - 161.1195681661))
  } else {
    red = Math.min(255, Math.max(0, 329.698727446 * Math.pow(temp - 60, -0.1332047592)))
    green = Math.min(255, Math.max(0, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)))
  }

  if (temp >= 66) {
    blue = 255
  } else if (temp <= 19) {
    blue = 0
  } else {
    blue = Math.min(255, Math.max(0, 138.5177312231 * Math.log(temp - 10) - 305.0447927307))
  }

  return `#${Math.round(red).toString(16).padStart(2, '0')}${Math.round(green).toString(16).padStart(2, '0')}${Math.round(blue).toString(16).padStart(2, '0')}`
}
