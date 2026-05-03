import { describe, it, expect, beforeEach } from 'vitest'
import { 
  Project, Room, Box, Item, StatusHistory, Tag,
  BoxStatus, SystemTagLabels, RiskLevel 
} from '@/models/types'
import { RiskChecker } from '@/services/RiskChecker'
import { ImportExportService } from '@/services/ImportExportService'

describe('Models', () => {
  describe('StatusHistory', () => {
    it('should create with default timestamp', () => {
      const history = StatusHistory.create(BoxStatus.PACKED, '封箱完成')
      expect(history.status).toBe(BoxStatus.PACKED)
      expect(history.note).toBe('封箱完成')
      expect(history.timestamp).toBeDefined()
    })
  })

  describe('Box', () => {
    it('should create with default pending status', () => {
      const box = new Box({ boxNumber: '1' })
      expect(box.status).toBe(BoxStatus.PENDING)
      expect(box.statusHistory.length).toBe(1)
    })

    it('should change status and record history', () => {
      const box = new Box({ boxNumber: '1' })
      const initialHistoryLength = box.statusHistory.length
      
      box.changeStatus(BoxStatus.PACKED, '封箱完成')
      
      expect(box.status).toBe(BoxStatus.PACKED)
      expect(box.statusHistory.length).toBe(initialHistoryLength + 1)
      
      const lastHistory = box.statusHistory[box.statusHistory.length - 1]
      expect(lastHistory.status).toBe(BoxStatus.PACKED)
      expect(lastHistory.note).toBe('封箱完成')
    })

    it('should return correct status label', () => {
      const box = new Box({ boxNumber: '1', status: BoxStatus.PACKED })
      expect(box.getCurrentStatusLabel()).toBe('已封箱')
    })
  })

  describe('Item', () => {
    it('should create with default values', () => {
      const item = new Item({ name: '测试物品' })
      expect(item.name).toBe('测试物品')
      expect(item.quantity).toBe(1)
      expect(item.weight).toBe(0)
      expect(item.tags).toEqual([])
    })

    it('should update and refresh updatedAt', () => {
      const item = new Item({ name: '测试物品' })
      const originalUpdatedAt = item.updatedAt
      
      // 等待一小段时间确保时间戳变化
      setTimeout(() => {
        item.update({ name: '新名称' })
        expect(item.name).toBe('新名称')
        expect(item.updatedAt).not.toBe(originalUpdatedAt)
      }, 1)
    })
  })

  describe('Project', () => {
    let project

    beforeEach(() => {
      project = new Project({
        name: '测试项目',
        rooms: [
          new Room({ name: '客厅', isSource: true }),
          new Room({ name: '新客厅', isSource: false })
        ]
      })
    })

    it('should initialize with system tags', () => {
      expect(project.tags.length).toBeGreaterThanOrEqual(4)
      const systemTagNames = project.tags.filter(t => t.isSystem).map(t => t.name)
      expect(systemTagNames).toContain('易碎')
      expect(systemTagNames).toContain('贵重')
      expect(systemTagNames).toContain('急用')
      expect(systemTagNames).toContain('证件')
    })

    it('should calculate box stats correctly', () => {
      const box = new Box({ boxNumber: '1' })
      project.boxes.push(box)
      
      project.items.push(new Item({ name: '物品1', boxId: box.id, quantity: 2, weight: 1.5 }))
      project.items.push(new Item({ name: '物品2', boxId: box.id, quantity: 1, weight: 0.5 }))
      
      const stats = project.calculateBoxStats(box.id)
      expect(stats.totalWeight).toBe(2 * 1.5 + 1 * 0.5)
      expect(stats.totalItems).toBe(2 + 1)
      expect(stats.itemCount).toBe(2)
    })

    it('should filter items by box', () => {
      const box1 = new Box({ boxNumber: '1' })
      const box2 = new Box({ boxNumber: '2' })
      project.boxes.push(box1, box2)
      
      const item1 = new Item({ name: '物品1', boxId: box1.id })
      const item2 = new Item({ name: '物品2', boxId: box2.id })
      const item3 = new Item({ name: '物品3', boxId: null })
      project.items.push(item1, item2, item3)
      
      expect(project.getItemsByBox(box1.id).length).toBe(1)
      expect(project.getItemsByBox(box1.id)[0].id).toBe(item1.id)
      expect(project.getUnboxedItems().length).toBe(1)
      expect(project.getUnboxedItems()[0].id).toBe(item3.id)
    })
  })
})

describe('RiskChecker', () => {
  let project
  let checker

  beforeEach(() => {
    project = new Project({
      name: '测试项目',
      rooms: [
        new Room({ name: '客厅', isSource: true }),
        new Room({ name: '新客厅', isSource: false }),
        new Room({ name: '主卧', isSource: true }),
        new Room({ name: '新主卧', isSource: false })
      ]
    })
    checker = new RiskChecker(project)
  })

  it('should detect overweight box', () => {
    const box = new Box({ boxNumber: '1', maxWeight: 10 })
    project.boxes.push(box)
    
    project.items.push(new Item({ 
      name: '重物', 
      boxId: box.id, 
      quantity: 1, 
      weight: 15 
    }))
    
    const risks = checker.checkAll()
    const overweightRisk = risks.find(r => r.type === 'weight_over_limit')
    
    expect(overweightRisk).toBeDefined()
    expect(overweightRisk.level).toBe(RiskLevel.HIGH)
    expect(overweightRisk.title).toBe('箱子重量超限')
  })

  it('should detect fragile item without cushioning', () => {
    const box = new Box({ boxNumber: '1' })
    project.boxes.push(box)
    
    project.items.push(new Item({ 
      name: '易碎物品', 
      boxId: box.id, 
      tags: [SystemTagLabels.fragile],
      cushioningNote: ''
    }))
    
    const risks = checker.checkAll()
    const fragileRisk = risks.find(r => r.type === 'fragile_no_cushioning')
    
    expect(fragileRisk).toBeDefined()
    expect(fragileRisk.level).toBe(RiskLevel.HIGH)
  })

  it('should detect urgent item in sealed box', () => {
    const box = new Box({ boxNumber: '1', status: BoxStatus.PACKED })
    project.boxes.push(box)
    
    project.items.push(new Item({ 
      name: '急用品', 
      boxId: box.id, 
      tags: [SystemTagLabels.urgent]
    }))
    
    const risks = checker.checkAll()
    const urgentRisk = risks.find(r => r.type === 'urgent_in_sealed_box')
    
    expect(urgentRisk).toBeDefined()
    expect(urgentRisk.level).toBe(RiskLevel.CRITICAL)
  })

  it('should detect document mixed with other items', () => {
    const box = new Box({ boxNumber: '1' })
    project.boxes.push(box)
    
    project.items.push(new Item({ 
      name: '重要证件', 
      boxId: box.id, 
      tags: [SystemTagLabels.document]
    }))
    project.items.push(new Item({ 
      name: '普通物品', 
      boxId: box.id, 
      tags: []
    }))
    
    const risks = checker.checkAll()
    const docRisk = risks.find(r => r.type === 'document_no_separate_tag')
    
    expect(docRisk).toBeDefined()
    expect(docRisk.level).toBe(RiskLevel.MEDIUM)
  })

  it('should not detect risk when fragile has cushioning', () => {
    const box = new Box({ boxNumber: '1' })
    project.boxes.push(box)
    
    project.items.push(new Item({ 
      name: '易碎物品', 
      boxId: box.id, 
      tags: [SystemTagLabels.fragile],
      cushioningNote: '使用气泡膜包裹'
    }))
    
    const risks = checker.checkAll()
    const fragileRisk = risks.find(r => r.type === 'fragile_no_cushioning')
    
    expect(fragileRisk).toBeUndefined()
  })

  it('should sort risks by severity', () => {
    const box1 = new Box({ boxNumber: '1', status: BoxStatus.PACKED })
    const box2 = new Box({ boxNumber: '2', maxWeight: 5 })
    project.boxes.push(box1, box2)
    
    project.items.push(new Item({ 
      name: '急用品', 
      boxId: box1.id, 
      tags: [SystemTagLabels.urgent]
    }))
    project.items.push(new Item({ 
      name: '重物', 
      boxId: box2.id, 
      quantity: 1, 
      weight: 10 
    }))
    project.items.push(new Item({ 
      name: '易碎品', 
      boxId: box2.id, 
      tags: [SystemTagLabels.fragile],
      cushioningNote: ''
    }))
    
    const risks = checker.checkAll()
    
    expect(risks[0].level).toBe(RiskLevel.CRITICAL)
    expect(risks[1].level).toBe(RiskLevel.HIGH)
  })
})

describe('ImportExportService', () => {
  let project

  beforeEach(() => {
    project = new Project({
      name: '测试项目',
      rooms: [
        new Room({ name: '客厅', isSource: true, id: 'room-1' }),
        new Room({ name: '主卧', isSource: true, id: 'room-2' })
      ]
    })
  })

  it('should generate CSV template correctly', () => {
    const template = `name,quantity,weight,room,tags,responsiblePerson,description,cushioningNote
示例物品1,1,2.5,主卧,易碎,张三,这是一个示例物品,使用气泡膜包裹
示例物品2,3,0.5,客厅,急用,李四,三个一组的物品,
示例物品3,1,0.1,书房,证件,王五,重要文件,`
    
    expect(template).toContain('name,quantity,weight')
  })

  it('should export moving list CSV', async () => {
    const box = new Box({ boxNumber: '1', name: '测试箱' })
    project.boxes.push(box)
    project.items.push(new Item({ 
      name: '测试物品', 
      boxId: box.id, 
      quantity: 2, 
      weight: 1.5,
      tags: ['易碎'],
      responsiblePerson: '张三'
    }))
    
    const csv = ImportExportService.exportMovingListCSV(project)
    
    expect(csv).toContain('箱号')
    expect(csv).toContain('测试物品')
    expect(csv).toContain('易碎')
    expect(csv).toContain('张三')
  })

  it('should export urgent list markdown', () => {
    const box = new Box({ boxNumber: '1', status: BoxStatus.PACKED })
    project.boxes.push(box)
    project.items.push(new Item({ 
      name: '急需物品', 
      boxId: box.id, 
      tags: [SystemTagLabels.urgent],
      responsiblePerson: '张三',
      description: '今晚需要用'
    }))
    project.items.push(new Item({ 
      name: '重要证件', 
      boxId: null, 
      tags: [SystemTagLabels.document]
    }))
    project.items.push(new Item({ 
      name: '易碎品', 
      boxId: box.id, 
      tags: [SystemTagLabels.fragile],
      cushioningNote: '小心轻放'
    }))
    
    const md = ImportExportService.exportUrgentUnpackListMarkdown(project)
    
    expect(md).toContain('# 测试项目 - 今晚先拆清单')
    expect(md).toContain('急需物品')
    expect(md).toContain('重要证件')
    expect(md).toContain('易碎品')
    expect(md).toContain('特别提醒')
  })

  it('should export box label HTML', () => {
    const box = new Box({ 
      boxNumber: '1', 
      name: '测试箱',
      responsiblePerson: '张三',
      targetRoomId: project.rooms[0].id
    })
    project.boxes.push(box)
    project.items.push(new Item({ 
      name: '测试物品1', 
      boxId: box.id, 
      quantity: 1, 
      weight: 1.5,
      tags: [SystemTagLabels.urgent, SystemTagLabels.fragile]
    }))
    project.items.push(new Item({ 
      name: '测试物品2', 
      boxId: box.id, 
      quantity: 2, 
      weight: 0.5
    }))
    
    const html = ImportExportService.exportBoxLabelHTML(project, box.id)
    
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('#1')
    expect(html).toContain('张三')
    expect(html).toContain('🔥 急用')
    expect(html).toContain('⚠️ 易碎')
    expect(html).toContain('测试物品1')
    expect(html).toContain('3件物品')
  })
})
