import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import {
  Segment,
  Crane,
  Obstacle,
  ObstacleType,
  TidalWindow,
  CapacityPoint,
  ImportResult,
  ImportError,
  Vector3D
} from '@/types'

const parseNumber = (value: string | undefined, defaultValue: number = 0): number => {
  if (value === undefined || value === '' || value === null) return defaultValue
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}

const parseBoolean = (value: string | undefined, defaultValue: boolean = false): boolean => {
  if (value === undefined || value === '' || value === null) return defaultValue
  const lowerValue = value.toLowerCase().trim()
  return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes'
}

const parseVector3D = (
  x: string | undefined,
  y: string | undefined,
  z: string | undefined
): Vector3D => ({
  x: parseNumber(x),
  y: parseNumber(y),
  z: parseNumber(z)
})

const parseObstacleType = (value: string | undefined): ObstacleType => {
  if (!value) return 'other'
  const lowerValue = value.toLowerCase().trim()
  const typeMap: Record<string, ObstacleType> = {
    'temporary_support': 'temporary_support',
    'temporary support': 'temporary_support',
    '临时支架': 'temporary_support',
    'transport_route': 'transport_route',
    'transport route': 'transport_route',
    '转运路线': 'transport_route',
    'existing_structure': 'existing_structure',
    'existing structure': 'existing_structure',
    '现有结构': 'existing_structure'
  }
  return typeMap[lowerValue] || 'other'
}

const parseDate = (value: string | undefined): Date => {
  if (!value) return new Date()
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

export const parseSegmentsCSV = async (file: File | string): Promise<ImportResult<Segment>> => {
  const errors: ImportError[] = []
  const warnings: string[] = []
  const segments: Segment[] = []

  return new Promise((resolve) => {
    const parseConfig = {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        results.data.forEach((row, index) => {
          const rowNum = index + 2
          
          try {
            const name = row.name || row.分段名称 || `分段-${index + 1}`
            const weight = parseNumber(row.weight || row.重量)
            const dimensions = {
              length: parseNumber(row.length || row.长度),
              width: parseNumber(row.width || row.宽度),
              height: parseNumber(row.height || row.高度)
            }

            if (dimensions.length <= 0 || dimensions.width <= 0 || dimensions.height <= 0) {
              errors.push({
                row: rowNum,
                column: '尺寸',
                message: '分段尺寸必须大于 0'
              })
              return
            }

            if (weight <= 0) {
              warnings.push(`第 ${rowNum} 行: 分段重量为 0 或为空，请确认`)
            }

            const cog = parseVector3D(
              row.cog_x || row.重心X,
              row.cog_y || row.重心Y,
              row.cog_z || row.重心Z
            )

            const liftingPoints: Vector3D[] = []
            const lpCount = parseNumber(row.lifting_point_count || row.吊点数量, 4)
            for (let i = 0; i < lpCount; i++) {
              const lp = parseVector3D(
                row[`lp${i + 1}_x`] || row[`吊点${i + 1}X`],
                row[`lp${i + 1}_y`] || row[`吊点${i + 1}Y`],
                row[`lp${i + 1}_z`] || row[`吊点${i + 1}Z`]
              )
              liftingPoints.push(lp)
            }

            const initialPosition = parseVector3D(
              row.initial_x || row.初始位置X,
              row.initial_y || row.初始位置Y,
              row.initial_z || row.初始位置Z
            )

            const targetPosition = parseVector3D(
              row.target_x || row.目标位置X,
              row.target_y || row.目标位置Y,
              row.target_z || row.目标位置Z
            )

            const segment: Segment = {
              id: uuidv4(),
              name,
              dimensions,
              weight,
              centerOfGravity: cog,
              liftingPoints: liftingPoints.length > 0 ? liftingPoints : [
                { x: -dimensions.length / 4, y: dimensions.height / 2, z: -dimensions.width / 4 },
                { x: dimensions.length / 4, y: dimensions.height / 2, z: -dimensions.width / 4 },
                { x: dimensions.length / 4, y: dimensions.height / 2, z: dimensions.width / 4 },
                { x: -dimensions.length / 4, y: dimensions.height / 2, z: dimensions.width / 4 }
              ],
              initialPosition,
              targetPosition,
              color: row.color || '#4CAF50',
              notes: row.notes || row.备注
            }

            segments.push(segment)
          } catch (e) {
            errors.push({
              row: rowNum,
              column: '解析错误',
              message: e instanceof Error ? e.message : '未知错误'
            })
          }
        })

        resolve({
          success: errors.length === 0 || segments.length > 0,
          data: segments,
          errors,
          warnings
        })
      },
      error: (error: Papa.ParseError) => {
        errors.push({
          row: 0,
          column: '文件',
          message: error.message
        })
        resolve({
          success: false,
          data: [],
          errors,
          warnings: []
        })
      }
    }

    if (typeof file === 'string') {
      Papa.parse(file, parseConfig)
    } else {
      Papa.parse(file, parseConfig)
    }
  })
}

export const parseCraneCSV = async (file: File | string): Promise<ImportResult<Crane>> => {
  const errors: ImportError[] = []
  const warnings: string[] = []
  const cranes: Crane[] = []

  return new Promise((resolve) => {
    const parseConfig = {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        results.data.forEach((row, index) => {
          const rowNum = index + 2

          try {
            const name = row.name || row.吊车名称 || `吊车-${index + 1}`
            const position = parseVector3D(
              row.position_x || row.位置X,
              row.position_y || row.位置Y,
              row.position_z || row.位置Z
            )

            const maxRadius = parseNumber(row.max_radius || row.最大半径, 50)
            const minRadius = parseNumber(row.min_radius || row.最小半径, 5)
            const maxHeight = parseNumber(row.max_height || row.最大高度, 80)
            const maxLiftCapacity = parseNumber(row.max_capacity || row.最大起重量, 500)
            const boomLength = parseNumber(row.boom_length || row.吊臂长度, 60)
            const jibLength = parseNumber(row.jib_length || row.副臂长度, 0)
            const slewSpeed = parseNumber(row.slew_speed || row.回转速度, 1)
            const hoistSpeed = parseNumber(row.hoist_speed || row.起升速度, 0.5)

            const capacityCurve: CapacityPoint[] = []
            const curveCount = parseNumber(row.curve_points || row.曲线点数, 5)
            for (let i = 0; i < curveCount; i++) {
              const radius = parseNumber(row[`curve${i + 1}_radius`] || row[`曲线${i + 1}半径`])
              const capacity = parseNumber(row[`curve${i + 1}_capacity`] || row[`曲线${i + 1}能力`])
              if (radius > 0 && capacity > 0) {
                capacityCurve.push({ radius, capacity })
              }
            }

            if (capacityCurve.length === 0) {
              capacityCurve.push({ radius: minRadius, capacity: maxLiftCapacity })
              capacityCurve.push({ radius: maxRadius, capacity: maxLiftCapacity * 0.3 })
              warnings.push(`第 ${rowNum} 行: 使用默认起重量曲线，请确认`)
            }

            const crane: Crane = {
              id: uuidv4(),
              name,
              position,
              maxRadius,
              minRadius,
              maxHeight,
              maxLiftCapacity,
              capacityCurve: capacityCurve.sort((a, b) => a.radius - b.radius),
              boomLength,
              jibLength,
              slewSpeed,
              hoistSpeed,
              color: row.color || '#FF9800'
            }

            cranes.push(crane)
          } catch (e) {
            errors.push({
              row: rowNum,
              column: '解析错误',
              message: e instanceof Error ? e.message : '未知错误'
            })
          }
        })

        resolve({
          success: errors.length === 0 || cranes.length > 0,
          data: cranes,
          errors,
          warnings
        })
      },
      error: (error: Papa.ParseError) => {
        errors.push({
          row: 0,
          column: '文件',
          message: error.message
        })
        resolve({
          success: false,
          data: [],
          errors,
          warnings: []
        })
      }
    }

    if (typeof file === 'string') {
      Papa.parse(file, parseConfig)
    } else {
      Papa.parse(file, parseConfig)
    }
  })
}

export const parseObstaclesCSV = async (file: File | string): Promise<ImportResult<Obstacle>> => {
  const errors: ImportError[] = []
  const warnings: string[] = []
  const obstacles: Obstacle[] = []

  return new Promise((resolve) => {
    const parseConfig = {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        results.data.forEach((row, index) => {
          const rowNum = index + 2

          try {
            const name = row.name || row.障碍物名称 || `障碍物-${index + 1}`
            const type = parseObstacleType(row.type || row.类型)
            const dimensions = {
              length: parseNumber(row.length || row.长度),
              width: parseNumber(row.width || row.宽度),
              height: parseNumber(row.height || row.高度)
            }

            const position = parseVector3D(
              row.position_x || row.位置X,
              row.position_y || row.位置Y,
              row.position_z || row.位置Z
            )

            const rotation = parseNumber(row.rotation || row.旋转角度)
            const isPermanent = parseBoolean(row.is_permanent || row.是否永久, false)

            const colorMap: Record<ObstacleType, string> = {
              temporary_support: '#F44336',
              transport_route: '#2196F3',
              existing_structure: '#9C27B0',
              other: '#795548'
            }

            const obstacle: Obstacle = {
              id: uuidv4(),
              name,
              type,
              dimensions,
              position,
              rotation,
              isPermanent,
              color: row.color || colorMap[type] || '#795548',
              description: row.description || row.描述
            }

            obstacles.push(obstacle)
          } catch (e) {
            errors.push({
              row: rowNum,
              column: '解析错误',
              message: e instanceof Error ? e.message : '未知错误'
            })
          }
        })

        resolve({
          success: errors.length === 0 || obstacles.length > 0,
          data: obstacles,
          errors,
          warnings
        })
      },
      error: (error: Papa.ParseError) => {
        errors.push({
          row: 0,
          column: '文件',
          message: error.message
        })
        resolve({
          success: false,
          data: [],
          errors,
          warnings: []
        })
      }
    }

    if (typeof file === 'string') {
      Papa.parse(file, parseConfig)
    } else {
      Papa.parse(file, parseConfig)
    }
  })
}

export const parseTidalWindowsCSV = async (file: File | string): Promise<ImportResult<TidalWindow>> => {
  const errors: ImportError[] = []
  const warnings: string[] = []
  const tidalWindows: TidalWindow[] = []

  return new Promise((resolve) => {
    const parseConfig = {
      header: true,
      skipEmptyLines: true,
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        results.data.forEach((row, index) => {
          const rowNum = index + 2

          try {
            const startTime = parseDate(row.start_time || row.开始时间)
            const endTime = parseDate(row.end_time || row.结束时间)
            const minHeight = parseNumber(row.min_height || row.最小潮位)
            const maxHeight = parseNumber(row.max_height || row.最大潮位)
            const safeClearance = parseNumber(row.safe_clearance || row.安全净空, 2)

            if (endTime <= startTime) {
              warnings.push(`第 ${rowNum} 行: 结束时间早于或等于开始时间，已自动调整`)
            }

            const tidalWindow: TidalWindow = {
              id: uuidv4(),
              startTime,
              endTime: endTime <= startTime ? new Date(startTime.getTime() + 2 * 60 * 60 * 1000) : endTime,
              minHeight,
              maxHeight,
              safeClearance,
              description: row.description || row.描述
            }

            tidalWindows.push(tidalWindow)
          } catch (e) {
            errors.push({
              row: rowNum,
              column: '解析错误',
              message: e instanceof Error ? e.message : '未知错误'
            })
          }
        })

        resolve({
          success: errors.length === 0 || tidalWindows.length > 0,
          data: tidalWindows.sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
          errors,
          warnings
        })
      },
      error: (error: Papa.ParseError) => {
        errors.push({
          row: 0,
          column: '文件',
          message: error.message
        })
        resolve({
          success: false,
          data: [],
          errors,
          warnings: []
        })
      }
    }

    if (typeof file === 'string') {
      Papa.parse(file, parseConfig)
    } else {
      Papa.parse(file, parseConfig)
    }
  })
}
