import localforage from 'localforage'
import { DataTypes, TunnelSection, GasSensor, InspectionTicket, ManholeRecord, RiskMarker, JudgmentNote, RiskTypes } from '@/models'

localforage.config({
  name: 'tunnelInspectionDB',
  version: 1.0,
  storeName: 'tunnel_data',
  description: '城市地下管廊巡检数据存储'
})

class DataStore {
  constructor() {
    this.cache = {
      [DataTypes.TUNNEL_SECTIONS]: [],
      [DataTypes.GAS_SENSORS]: [],
      [DataTypes.INSPECTION_TICKETS]: [],
      [DataTypes.MANHOLE_RECORDS]: [],
      [DataTypes.RISK_MARKERS]: [],
      [DataTypes.JUDGMENT_NOTES]: []
    }
  }

  async init() {
    for (const key of Object.values(DataTypes)) {
      const data = await localforage.getItem(key)
      if (data) {
        this.cache[key] = data
      }
    }
    await this.generateRiskMarkers()
    return this.cache
  }

  async save(dataType, data) {
    this.cache[dataType] = data
    await localforage.setItem(dataType, data)
    return data
  }

  async saveItem(dataType, item) {
    const index = this.cache[dataType].findIndex(i => i.id === item.id)
    if (index >= 0) {
      this.cache[dataType][index] = item
    } else {
      this.cache[dataType].push(item)
    }
    await this.save(dataType, this.cache[dataType])
    return item
  }

  async getItem(dataType, id) {
    return this.cache[dataType].find(item => item.id === id)
  }

  async getItems(dataType) {
    return [...this.cache[dataType]]
  }

  async deleteItem(dataType, id) {
    const index = this.cache[dataType].findIndex(i => i.id === id)
    if (index >= 0) {
      this.cache[dataType].splice(index, 1)
      await this.save(dataType, this.cache[dataType])
    }
    return true
  }

  async clearAll() {
    for (const key of Object.values(DataTypes)) {
      this.cache[key] = []
      await localforage.removeItem(key)
    }
    return true
  }

  async generateRiskMarkers() {
    const sensors = await this.getItems(DataTypes.GAS_SENSORS)
    const tickets = await this.getItems(DataTypes.INSPECTION_TICKETS)
    const existingRisks = await this.getItems(DataTypes.RISK_MARKERS)
    const existingRiskIds = existingRisks.map(r => r.id)
    
    const newRisks = []

    for (const sensorData of sensors) {
      const sensor = new GasSensor(sensorData)
      const risks = sensor.getRiskStatus()
      
      for (const risk of risks) {
        const riskId = `risk_${sensor.id}_${risk.type}`
        if (!existingRiskIds.includes(riskId)) {
          newRisks.push(new RiskMarker({
            id: riskId,
            type: risk.type,
            sectionId: sensor.sectionId,
            position: sensor.position,
            level: risk.level,
            message: risk.message,
            sourceType: 'sensor',
            sourceId: sensor.id
          }))
        }
      }
    }

    for (const ticketData of tickets) {
      const ticket = new InspectionTicket(ticketData)
      if (ticket.isUnclosed()) {
        const riskId = `risk_ticket_${ticket.id}`
        if (!existingRiskIds.includes(riskId)) {
          const section = await this.getItem(DataTypes.TUNNEL_SECTIONS, ticket.sectionId)
          const position = section ? {
            x: (section.startPoint.x + section.endPoint.x) / 2,
            y: (section.startPoint.y + section.endPoint.y) / 2,
            z: (section.startPoint.z + section.endPoint.z) / 2
          } : { x: 0, y: 0, z: 0 }

          newRisks.push(new RiskMarker({
            id: riskId,
            type: RiskTypes.UNOPENED_TICKET,
            sectionId: ticket.sectionId,
            position,
            level: ticket.isOverdue() ? 'high' : 'medium',
            message: `未闭环工单: ${ticket.ticketNo} - ${ticket.inspectionType}`,
            sourceType: 'ticket',
            sourceId: ticket.id
          }))
        }
      }
    }

    for (const risk of newRisks) {
      await this.saveItem(DataTypes.RISK_MARKERS, risk)
    }

    return [...existingRisks, ...newRisks]
  }

  async addJudgmentNote(note) {
    const judgmentNote = new JudgmentNote(note)
    await this.saveItem(DataTypes.JUDGMENT_NOTES, judgmentNote)
    
    if (judgmentNote.riskId) {
      const risk = await this.getItem(DataTypes.RISK_MARKERS, judgmentNote.riskId)
      if (risk) {
        risk.judgment = judgmentNote.judgment
        await this.saveItem(DataTypes.RISK_MARKERS, risk)
      }
    }

    return judgmentNote
  }

  async getSectionRisks(sectionId) {
    const allRisks = await this.getItems(DataTypes.RISK_MARKERS)
    return allRisks.filter(r => r.sectionId === sectionId)
  }

  async getSectionNotes(sectionId) {
    const allNotes = await this.getItems(DataTypes.JUDGMENT_NOTES)
    return allNotes.filter(n => n.sectionId === sectionId)
  }
}

const dataStore = new DataStore()

export const useDataStore = () => dataStore
