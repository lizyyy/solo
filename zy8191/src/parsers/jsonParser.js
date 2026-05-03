export class JSONParser {
  static parse(content) {
    try {
      const data = typeof content === 'string' ? JSON.parse(content) : content
      return this.transformFinds(data)
    } catch (error) {
      throw new Error(`JSON解析错误: ${error.message}`)
    }
  }

  static transformFinds(data) {
    let finds = []

    if (Array.isArray(data)) {
      finds = data
    } else if (data.finds || data.出土物) {
      finds = data.finds || data.出土物
    } else if (data.items || data.物品) {
      finds = data.items || data.物品
    } else {
      finds = [data]
    }

    return finds.map((find, index) => ({
      id: String(find.id || find.编号 || `F${index + 1}`),
      name: find.name || find.名称 || `出土物 ${index + 1}`,
      type: find.type || find.类型 || '未知',
      material: find.material || find.材质 || '',
      description: find.description || find.描述 || '',
      layerId: find.layer_id || find.地层编号 || find.layer || null,
      coordinates: this.parseCoordinates(find),
      elevation: this.parseNumber(find.elevation || find.高程),
      condition: find.condition || find.保存状况 || '',
      notes: find.notes || find.备注 || '',
      photos: find.photos || find.照片 || [],
      originalData: { ...find }
    }))
  }

  static parseNumber(value) {
    if (value === null || value === undefined || value === '') return null
    const num = Number(value)
    return isNaN(num) ? null : num
  }

  static parseCoordinates(find) {
    if (find.coordinates) {
      if (Array.isArray(find.coordinates)) {
        return {
          x: this.parseNumber(find.coordinates[0]),
          y: this.parseNumber(find.coordinates[1]),
          z: this.parseNumber(find.coordinates[2] || find.elevation)
        }
      }
      if (typeof find.coordinates === 'object') {
        return {
          x: this.parseNumber(find.coordinates.x),
          y: this.parseNumber(find.coordinates.y),
          z: this.parseNumber(find.coordinates.z || find.elevation)
        }
      }
    }

    return {
      x: this.parseNumber(find.x || find.x坐标),
      y: this.parseNumber(find.y || find.y坐标),
      z: this.parseNumber(find.z || find.z坐标 || find.elevation || find.高程)
    }
  }

  static validateFinds(finds) {
    const errors = []
    const warnings = []

    finds.forEach((find, index) => {
      if (!find.id) {
        errors.push(`第 ${index + 1} 个出土物: 缺少编号`)
      }

      if (!find.layerId) {
        warnings.push(`出土物 ${find.id}: 缺少关联地层编号`)
      }

      const coords = find.coordinates
      if (coords.x === null || coords.y === null || coords.z === null) {
        warnings.push(`出土物 ${find.id}: 坐标数据不完整`)
      }
    })

    return { errors, warnings }
  }
}

export default JSONParser
