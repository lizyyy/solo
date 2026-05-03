import { RiskLevel, BoxStatus, SystemTagLabels } from '@/models/types'

export const RiskTypes = {
  WEIGHT_OVER_LIMIT: 'weight_over_limit',
  ITEM_COUNT_OVER_LIMIT: 'item_count_over_limit',
  FRAGILE_NO_CUSHIONING: 'fragile_no_cushioning',
  URGENT_IN_SEALED_BOX: 'urgent_in_sealed_box',
  DOCUMENT_NO_SEPARATE_TAG: 'document_no_separate_tag',
  ROOM_BOX_CONFLICT: 'room_box_conflict',
  SIMILAR_ITEMS_SCATTERED: 'similar_items_scattered',
  EMPTY_BOX_SEALED: 'empty_box_sealed'
}

export class RiskChecker {
  constructor(project) {
    this.project = project
  }

  checkAll() {
    const risks = []
    
    this.project.boxes.forEach(box => {
      risks.push(...this.checkBox(box))
    })
    
    this.project.items.forEach(item => {
      risks.push(...this.checkItem(item))
    })
    
    risks.push(...this.checkItemDistribution())
    
    return risks.sort((a, b) => {
      const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 }
      return levelOrder[a.level] - levelOrder[b.level]
    })
  }

  checkBox(box) {
    const risks = []
    const stats = this.project.calculateBoxStats(box.id)
    
    if (stats.totalWeight > box.maxWeight) {
      risks.push({
        id: `${RiskTypes.WEIGHT_OVER_LIMIT}-${box.id}`,
        type: RiskTypes.WEIGHT_OVER_LIMIT,
        level: RiskLevel.HIGH,
        title: '箱子重量超限',
        description: `箱子 #${box.boxNumber} 当前重量 ${stats.totalWeight.toFixed(1)}kg，超过上限 ${box.maxWeight}kg`,
        affectedEntities: { boxId: box.id, boxNumber: box.boxNumber },
        suggestion: `建议减少箱子内物品，或拆分到其他箱子。当前超重 ${(stats.totalWeight - box.maxWeight).toFixed(1)}kg`,
        details: {
          currentWeight: stats.totalWeight,
          maxWeight: box.maxWeight,
          overweight: stats.totalWeight - box.maxWeight
        }
      })
    }
    
    if (stats.totalItems > box.maxItems) {
      risks.push({
        id: `${RiskTypes.ITEM_COUNT_OVER_LIMIT}-${box.id}`,
        type: RiskTypes.ITEM_COUNT_OVER_LIMIT,
        level: RiskLevel.MEDIUM,
        title: '箱子物品数量超限',
        description: `箱子 #${box.boxNumber} 当前物品数量 ${stats.totalItems} 件，超过上限 ${box.maxItems} 件`,
        affectedEntities: { boxId: box.id, boxNumber: box.boxNumber },
        suggestion: '建议拆分到其他箱子，或减少非紧急物品',
        details: {
          currentCount: stats.totalItems,
          maxCount: box.maxItems
        }
      })
    }
    
    if (box.status === BoxStatus.PACKED || box.status === BoxStatus.MOVED) {
      if (stats.itemCount === 0) {
        risks.push({
          id: `${RiskTypes.EMPTY_BOX_SEALED}-${box.id}`,
          type: RiskTypes.EMPTY_BOX_SEALED,
          level: RiskLevel.LOW,
          title: '空箱子已封箱',
          description: `箱子 #${box.boxNumber} 已封箱但没有装入任何物品`,
          affectedEntities: { boxId: box.id, boxNumber: box.boxNumber },
          suggestion: '建议检查是否忘记装物品，或者取消封箱状态',
          details: {}
        })
      }
    }
    
    if (box.targetRoomId) {
      const boxItems = this.project.getItemsByBox(box.id)
      const targetRoom = this.project.getRoomById(box.targetRoomId)
      
      boxItems.forEach(item => {
        if (item.roomId && item.roomId !== box.targetRoomId) {
          const sourceRoom = this.project.getRoomById(item.roomId)
          if (sourceRoom && targetRoom && sourceRoom.isSource !== targetRoom.isSource) {
            risks.push({
              id: `${RiskTypes.ROOM_BOX_CONFLICT}-${box.id}-${item.id}`,
              type: RiskTypes.ROOM_BOX_CONFLICT,
              level: RiskLevel.MEDIUM,
              title: '目标房间与箱子位置冲突',
              description: `物品"${item.name}"来自${sourceRoom.name}，但箱子 #${box.boxNumber} 目标房间是${targetRoom.name}`,
              affectedEntities: { 
                boxId: box.id, 
                boxNumber: box.boxNumber,
                itemId: item.id,
                itemName: item.name
              },
              suggestion: '建议确认物品是否放错箱子，或调整箱子的目标房间',
              details: {
                sourceRoomId: item.roomId,
                sourceRoomName: sourceRoom.name,
                targetRoomId: box.targetRoomId,
                targetRoomName: targetRoom.name
              }
            })
          }
        }
      })
    }
    
    return risks
  }

  checkItem(item) {
    const risks = []
    const isFragile = item.tags.includes(SystemTagLabels.fragile)
    const isUrgent = item.tags.includes(SystemTagLabels.urgent)
    const isDocument = item.tags.includes(SystemTagLabels.document)
    
    if (isFragile && !item.cushioningNote?.trim()) {
      risks.push({
        id: `${RiskTypes.FRAGILE_NO_CUSHIONING}-${item.id}`,
        type: RiskTypes.FRAGILE_NO_CUSHIONING,
        level: RiskLevel.HIGH,
        title: '易碎品缺少缓冲说明',
        description: `物品"${item.name}"标记为易碎品，但未填写缓冲保护说明`,
        affectedEntities: { itemId: item.id, itemName: item.name },
        suggestion: '请添加缓冲保护说明，例如："使用气泡膜包裹"、"竖放勿压"等',
        details: { itemName: item.name }
      })
    }
    
    if (isUrgent && item.boxId) {
      const box = this.project.getBoxById(item.boxId)
      if (box && (box.status === BoxStatus.PACKED || box.status === BoxStatus.MOVED)) {
        risks.push({
          id: `${RiskTypes.URGENT_IN_SEALED_BOX}-${item.id}`,
          type: RiskTypes.URGENT_IN_SEALED_BOX,
          level: RiskLevel.CRITICAL,
          title: '急用品被放入已封箱箱子',
          description: `急用品"${item.name}"被放入已${box.getCurrentStatusLabel()}的箱子 #${box.boxNumber}`,
          affectedEntities: { 
            itemId: item.id, 
            itemName: item.name,
            boxId: box.id,
            boxNumber: box.boxNumber
          },
          suggestion: '强烈建议将急用品单独放置，或在搬运清单中特别标注此箱子需要优先拆箱',
          details: {
            boxStatus: box.status,
            boxStatusLabel: box.getCurrentStatusLabel()
          }
        })
      }
    }
    
    if (isDocument && item.boxId) {
      const boxItems = this.project.getItemsByBox(item.boxId)
      const nonDocumentItems = boxItems.filter(bi => 
        bi.id !== item.id && !bi.tags.includes(SystemTagLabels.document)
      )
      
      if (nonDocumentItems.length > 0) {
        risks.push({
          id: `${RiskTypes.DOCUMENT_NO_SEPARATE_TAG}-${item.id}`,
          type: RiskTypes.DOCUMENT_NO_SEPARATE_TAG,
          level: RiskLevel.MEDIUM,
          title: '证件类物品未单独放置',
          description: `证件"${item.name}"与其他物品混装在同一箱子中`,
          affectedEntities: { itemId: item.id, itemName: item.name },
          suggestion: '建议将证件、合同等重要文件单独放置在一个文件袋或专用箱子中，便于随时取用',
          details: {
            mixedWithCount: nonDocumentItems.length,
            mixedWithItems: nonDocumentItems.slice(0, 3).map(i => i.name)
          }
        })
      }
    }
    
    return risks
  }

  checkItemDistribution() {
    const risks = []
    const nameGroups = {}
    
    this.project.items.forEach(item => {
      const key = item.name.toLowerCase().trim()
      if (!nameGroups[key]) {
        nameGroups[key] = []
      }
      nameGroups[key].push(item)
    })
    
    Object.entries(nameGroups).forEach(([name, items]) => {
      const boxIds = new Set(items.map(i => i.boxId).filter(Boolean))
      
      if (boxIds.size > 2) {
        const originalItem = items[0]
        risks.push({
          id: `${RiskTypes.SIMILAR_ITEMS_SCATTERED}-${name}`,
          type: RiskTypes.SIMILAR_ITEMS_SCATTERED,
          level: RiskLevel.LOW,
          title: '同类物品分散在多个箱子',
          description: `"${originalItem.name}"等同类物品分散在 ${boxIds.size} 个箱子中`,
          affectedEntities: { itemName: originalItem.name },
          suggestion: '建议将同类物品尽量放在一起，方便拆箱时查找',
          details: {
            boxCount: boxIds.size,
            boxNumbers: Array.from(boxIds).map(bid => {
              const box = this.project.getBoxById(bid)
              return box ? `#${box.boxNumber}` : bid
            })
          }
        })
      }
    })
    
    return risks
  }
}

export function formatRiskForDisplay(risk) {
  const levelLabels = {
    [RiskLevel.LOW]: { label: '低风险', color: 'info' },
    [RiskLevel.MEDIUM]: { label: '中风险', color: 'warning' },
    [RiskLevel.HIGH]: { label: '高风险', color: 'danger' },
    [RiskLevel.CRITICAL]: { label: '严重风险', color: 'danger' }
  }
  
  return {
    ...risk,
    levelDisplay: levelLabels[risk.level] || { label: '未知', color: 'info' }
  }
}
