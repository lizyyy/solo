export function calculateMaterialPlanning(orders, recipes, materials, inventory, lossRecords, substitutePlans) {
  const result = {
    summary: {
      totalOrders: 0,
      totalBouquets: 0,
      confirmedOrders: 0,
      pendingOrders: 0
    },
    materialRequirements: [],
    inventoryStatus: [],
    substituteSuggestions: [],
    warnings: []
  }

  const confirmedOrders = orders.filter(o => o.status === 'confirmed')
  const pendingOrders = orders.filter(o => o.status === 'pending')
  
  result.summary.totalOrders = orders.length
  result.summary.totalBouquets = orders.reduce((sum, o) => sum + o.quantity, 0)
  result.summary.confirmedOrders = confirmedOrders.length
  result.summary.pendingOrders = pendingOrders.length

  const materialNeeds = {}
  const recipeMap = {}
  recipes.forEach(r => { recipeMap[r.id] = r })

  orders.forEach(order => {
    if (order.status === 'rejected') return
    
    const recipe = recipeMap[order.bouquetId]
    if (!recipe) {
      result.warnings.push({
        type: 'missing_recipe',
        orderId: order.id,
        orderNo: order.orderNo,
        message: `订单 ${order.orderNo} 关联的花束配方不存在`
      })
      return
    }

    recipe.materials.forEach(mat => {
      if (!materialNeeds[mat.materialId]) {
        materialNeeds[mat.materialId] = {
          materialId: mat.materialId,
          baseQuantity: 0,
          lossQuantity: 0,
          totalNeeded: 0
        }
      }
      materialNeeds[mat.materialId].baseQuantity += mat.quantity * order.quantity
    })
  })

  const materialMap = {}
  materials.forEach(m => { materialMap[m.id] = m })

  const inventoryMap = {}
  inventory.forEach(inv => {
    if (!inventoryMap[inv.materialId]) {
      inventoryMap[inv.materialId] = {
        materialId: inv.materialId,
        available: 0,
        pending: 0
      }
    }
    inventoryMap[inv.materialId].available += inv.quantity || 0
    inventoryMap[inv.materialId].pending += inv.pendingArrival || 0
  })

  const lossMap = {}
  lossRecords.forEach(loss => {
    if (loss.status !== 'confirmed') return
    if (!lossMap[loss.materialId]) {
      lossMap[loss.materialId] = 0
    }
    lossMap[loss.materialId] += loss.quantity || 0
  })

  const substituteMap = {}
  substitutePlans.forEach(plan => {
    if (plan.status !== 'active') return
    substituteMap[plan.originalMaterialId] = plan
  })

  Object.keys(materialNeeds).forEach(materialId => {
    const need = materialNeeds[materialId]
    const material = materialMap[materialId]
    const inv = inventoryMap[materialId] || { available: 0, pending: 0 }
    const lossQty = lossMap[materialId] || 0
    const defaultLossRate = material ? (material.defaultLossRate || 0.1) : 0.1
    
    const expectedLoss = Math.ceil(need.baseQuantity * defaultLossRate)
    need.lossQuantity = Math.max(lossQty, expectedLoss)
    need.totalNeeded = need.baseQuantity + need.lossQuantity

    const available = inv.available
    const shortage = Math.max(0, need.totalNeeded - available)
    const status = shortage > 0 ? (shortage <= inv.pending ? 'pending' : 'shortage') : 'sufficient'

    const substitute = substituteMap[materialId]

    result.materialRequirements.push({
      materialId,
      materialName: material ? material.name : '未知花材',
      materialCategory: material ? material.category : '',
      unit: material ? material.unit : '支',
      baseQuantity: need.baseQuantity,
      lossQuantity: need.lossQuantity,
      totalNeeded: need.totalNeeded,
      available,
      pending: inv.pending,
      shortage,
      status,
      substitute
    })

    if (shortage > 0 && !substitute) {
      result.warnings.push({
        type: 'material_shortage',
        materialId,
        materialName: material ? material.name : '未知花材',
        shortage,
        message: `花材 ${material ? material.name : materialId} 缺口 ${shortage} 支，暂无替换方案`
      })
    }
  })

  result.inventoryStatus = materials.map(m => {
    const inv = inventoryMap[m.id] || { available: 0, pending: 0 }
    const loss = lossMap[m.id] || 0
    return {
      materialId: m.id,
      materialName: m.name,
      category: m.category,
      unit: m.unit,
      available: inv.available,
      pending: inv.pending,
      loss,
      total: inv.available + inv.pending
    }
  })

  return result
}

export function exportToExcel(data, filename) {
  const XLSX = require('xlsx')
  const wb = XLSX.utils.book_new()
  
  if (data.materialRequirements && data.materialRequirements.length > 0) {
    const ws1 = XLSX.utils.json_to_sheet(data.materialRequirements.map(item => ({
      '花材名称': item.materialName,
      '分类': item.materialCategory,
      '单位': item.unit,
      '基础需求': item.baseQuantity,
      '损耗预估': item.lossQuantity,
      '总需求': item.totalNeeded,
      '现有库存': item.available,
      '待到货': item.pending,
      '缺口': item.shortage,
      '状态': item.status === 'sufficient' ? '充足' : item.status === 'pending' ? '待到货' : '缺口'
    })))
    XLSX.utils.book_append_sheet(wb, ws1, '备料需求')
  }

  if (data.inventoryStatus && data.inventoryStatus.length > 0) {
    const ws2 = XLSX.utils.json_to_sheet(data.inventoryStatus.map(item => ({
      '花材名称': item.materialName,
      '分类': item.category,
      '单位': item.unit,
      '现有库存': item.available,
      '待到货': item.pending,
      '已确认损耗': item.loss,
      '总计': item.total
    })))
    XLSX.utils.book_append_sheet(wb, ws2, '库存状态')
  }

  if (data.warnings && data.warnings.length > 0) {
    const ws3 = XLSX.utils.json_to_sheet(data.warnings.map(item => ({
      '类型': item.type,
      '消息': item.message
    })))
    XLSX.utils.book_append_sheet(wb, ws3, '预警信息')
  }

  XLSX.writeFile(wb, filename)
}