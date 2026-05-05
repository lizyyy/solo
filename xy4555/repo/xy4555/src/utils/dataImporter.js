import { useDataStore } from '@/store'
import { DataTypes, TunnelSection, GasSensor, InspectionTicket, ManholeRecord } from '@/models'

export const ImportTypes = {
  TUNNEL_SECTIONS: 'tunnel_sections',
  GAS_SENSORS: 'gas_sensors',
  INSPECTION_TICKETS: 'inspection_tickets',
  MANHOLE_RECORDS: 'manhole_records',
  ALL: 'all'
}

export class DataImporter {
  constructor() {
    this.store = useDataStore()
  }

  async importFromFile(file, importType) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const data = JSON.parse(e.target.result)
          const result = await this.importData(data, importType)
          resolve(result)
        } catch (error) {
          reject(new Error(`数据解析失败: ${error.message}`))
        }
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file)
    })
  }

  async importData(data, importType) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    }

    switch (importType) {
      case ImportTypes.TUNNEL_SECTIONS:
        return this.importTunnelSections(data, results)
      case ImportTypes.GAS_SENSORS:
        return this.importGasSensors(data, results)
      case ImportTypes.INSPECTION_TICKETS:
        return this.importInspectionTickets(data, results)
      case ImportTypes.MANHOLE_RECORDS:
        return this.importManholeRecords(data, results)
      case ImportTypes.ALL:
        return this.importAll(data, results)
      default:
        throw new Error('未知的导入类型')
    }
  }

  async importTunnelSections(data, results) {
    const sections = Array.isArray(data) ? data : [data]
    
    for (const sectionData of sections) {
      try {
        const section = new TunnelSection(sectionData)
        if (!section.id) {
          section.id = `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        await this.store.saveItem(DataTypes.TUNNEL_SECTIONS, section)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          data: sectionData,
          error: error.message
        })
      }
    }
    
    return results
  }

  async importGasSensors(data, results) {
    const sensors = Array.isArray(data) ? data : [data]
    
    for (const sensorData of sensors) {
      try {
        const sensor = new GasSensor(sensorData)
        if (!sensor.id) {
          sensor.id = `sensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        await this.store.saveItem(DataTypes.GAS_SENSORS, sensor)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          data: sensorData,
          error: error.message
        })
      }
    }
    
    await this.store.generateRiskMarkers()
    return results
  }

  async importInspectionTickets(data, results) {
    const tickets = Array.isArray(data) ? data : [data]
    
    for (const ticketData of tickets) {
      try {
        const ticket = new InspectionTicket(ticketData)
        if (!ticket.id) {
          ticket.id = `ticket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        await this.store.saveItem(DataTypes.INSPECTION_TICKETS, ticket)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          data: ticketData,
          error: error.message
        })
      }
    }
    
    await this.store.generateRiskMarkers()
    return results
  }

  async importManholeRecords(data, results) {
    const records = Array.isArray(data) ? data : [data]
    
    for (const recordData of records) {
      try {
        const record = new ManholeRecord(recordData)
        if (!record.id) {
          record.id = `manhole_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
        await this.store.saveItem(DataTypes.MANHOLE_RECORDS, record)
        results.success++
      } catch (error) {
        results.failed++
        results.errors.push({
          data: recordData,
          error: error.message
        })
      }
    }
    
    return results
  }

  async importAll(data, results) {
    if (data.tunnel_sections) {
      await this.importTunnelSections(data.tunnel_sections, results)
    }
    if (data.gas_sensors) {
      await this.importGasSensors(data.gas_sensors, results)
    }
    if (data.inspection_tickets) {
      await this.importInspectionTickets(data.inspection_tickets, results)
    }
    if (data.manhole_records) {
      await this.importManholeRecords(data.manhole_records, results)
    }
    
    return results
  }
}

export const useDataImporter = () => new DataImporter()
