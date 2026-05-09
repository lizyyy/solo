import ExcelJS from 'exceljs'
import * as csvWriter from 'csv-writer'
import * as fs from 'fs'
import * as path from 'path'
import { db } from './database'
import { logger } from './logger'

class ExportService {
  async exportInventoryToExcel(filePath: string, params?: { category?: string }) {
    const where: any = {}
    if (params?.category) where.category = params.category

    const products = await db.product.findMany({
      where,
      include: { inventory: true },
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('库存清单')

    worksheet.columns = [
      { header: 'SKU', key: 'sku', width: 20 },
      { header: '商品名称', key: 'name', width: 30 },
      { header: '分类', key: 'category', width: 15 },
      { header: '单位', key: 'unit', width: 10 },
      { header: '库存数量', key: 'quantity', width: 15 },
      { header: '最小库存', key: 'minQuantity', width: 12 },
      { header: '库位', key: 'location', width: 15 },
      { header: '描述', key: 'description', width: 40 },
    ]

    worksheet.getRow(1).font = { bold: true }

    for (const p of products) {
      worksheet.addRow({
        sku: p.sku,
        name: p.name,
        category: p.category || '',
        unit: p.unit,
        quantity: p.inventory?.quantity || 0,
        minQuantity: p.inventory?.minQuantity || 0,
        location: p.inventory?.location || '',
        description: p.description || '',
      })
    }

    await workbook.xlsx.writeFile(filePath)
    return { filePath, count: products.length }
  }

  async exportInventoryToCSV(filePath: string, params?: { category?: string }) {
    const where: any = {}
    if (params?.category) where.category = params.category

    const products = await db.product.findMany({
      where,
      include: { inventory: true },
    })

    const records = products.map(p => ({
      sku: p.sku,
      name: p.name,
      category: p.category || '',
      unit: p.unit,
      quantity: p.inventory?.quantity || 0,
      minQuantity: p.inventory?.minQuantity || 0,
      location: p.inventory?.location || '',
      description: p.description || '',
    }))

    const writer = csvWriter.createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'sku', title: 'SKU' },
        { id: 'name', title: '商品名称' },
        { id: 'category', title: '分类' },
        { id: 'unit', title: '单位' },
        { id: 'quantity', title: '库存数量' },
        { id: 'minQuantity', title: '最小库存' },
        { id: 'location', title: '库位' },
        { id: 'description', title: '描述' },
      ],
    })

    await writer.writeRecords(records)
    return { filePath, count: records.length }
  }

  async exportTaskRecordsToExcel(taskId: string, filePath: string) {
    const task = await db.inventoryTask.findUnique({
      where: { id: taskId },
      include: {
        records: {
          include: { product: true, user: true },
        },
      },
    })

    if (!task) throw new Error('任务不存在')

    const workbook = new ExcelJS.Workbook()

    const summarySheet = workbook.addWorksheet('任务概览')
    summarySheet.addRow(['任务名称', task.name])
    summarySheet.addRow(['任务描述', task.description || ''])
    summarySheet.addRow(['状态', task.status])
    summarySheet.addRow(['开始时间', task.startedAt?.toISOString() || ''])
    summarySheet.addRow(['完成时间', task.completedAt?.toISOString() || ''])

    const recordsSheet = workbook.addWorksheet('盘点记录')
    recordsSheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: '商品名称', key: 'productName', width: 25 },
      { header: '账面数量', key: 'expectedQty', width: 12 },
      { header: '实际数量', key: 'actualQty', width: 12 },
      { header: '差异', key: 'difference', width: 10 },
      { header: '盘点人', key: 'userName', width: 12 },
      { header: '备注', key: 'remark', width: 30 },
      { header: '盘点时间', key: 'createdAt', width: 20 },
    ]

    recordsSheet.getRow(1).font = { bold: true }

    for (const r of task.records) {
      recordsSheet.addRow({
        sku: r.product.sku,
        productName: r.product.name,
        expectedQty: r.expectedQty,
        actualQty: r.actualQty,
        difference: r.difference,
        userName: r.user.name,
        remark: r.remark || '',
        createdAt: r.createdAt.toISOString(),
      })
    }

    await workbook.xlsx.writeFile(filePath)
    return { filePath, count: task.records.length }
  }

  async importInventoryFromExcel(filePath: string, userId: string) {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(filePath)
    const worksheet = workbook.worksheets[0]

    const imported = []
    let errors: string[] = []

    const rows = worksheet.getRows(2, worksheet.rowCount - 1) || []

    for (const row of rows) {
      try {
        const sku = row.getCell(1).value as string
        const name = row.getCell(2).value as string
        const category = (row.getCell(3).value as string) || undefined
        const unit = (row.getCell(4).value as string) || '个'
        const quantity = Number(row.getCell(5).value) || 0
        const minQuantity = Number(row.getCell(6).value) || 0
        const location = (row.getCell(7).value as string) || undefined
        const description = (row.getCell(8).value as string) || undefined

        if (!sku || !name) {
          errors.push(`第${row.number}行: SKU和商品名称不能为空`)
          continue
        }

        const existing = await db.product.findUnique({ where: { sku } })

        let productId: string
        if (existing) {
          await db.product.update({
            where: { id: existing.id },
            data: { name, category, unit, description },
          })
          productId = existing.id
        } else {
          const product = await db.product.create({
            data: { sku, name, category, unit, description },
          })
          productId = product.id
        }

        const inv = await db.inventory.findUnique({ where: { productId } })
        if (inv) {
          await db.inventory.update({
            where: { productId },
            data: { quantity, minQuantity, location },
          })
        } else {
          await db.inventory.create({
            data: { productId, quantity, minQuantity, location },
          })
        }

        imported.push(sku)
      } catch (err: any) {
        errors.push(`第${row.number}行: ${err.message}`)
      }
    }

    await logger.info({
      userId,
      action: 'IMPORT',
      module: 'INVENTORY',
      details: {
        filePath,
        imported: imported.length,
        errors: errors.length,
      },
    })

    return {
      imported: imported.length,
      errors,
      importedItems: imported,
    }
  }

  async exportLogsToExcel(filePath: string, params?: {
    userId?: string
    module?: string
    startDate?: Date
    endDate?: Date
  }) {
    const where: any = {}
    if (params?.userId) where.userId = params.userId
    if (params?.module) where.module = params.module
    if (params?.startDate || params?.endDate) {
      where.createdAt = {}
      if (params.startDate) where.createdAt.gte = params.startDate
      if (params.endDate) where.createdAt.lte = params.endDate
    }

    const logs = await db.auditLog.findMany({
      where,
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('审计日志')

    worksheet.columns = [
      { header: '时间', key: 'createdAt', width: 22 },
      { header: '用户', key: 'userName', width: 12 },
      { header: '模块', key: 'module', width: 15 },
      { header: '操作', key: 'action', width: 15 },
      { header: '级别', key: 'level', width: 10 },
      { header: '详情', key: 'details', width: 50 },
    ]

    worksheet.getRow(1).font = { bold: true }

    for (const log of logs) {
      worksheet.addRow({
        createdAt: log.createdAt.toISOString(),
        userName: log.user.name,
        module: log.module,
        action: log.action,
        level: log.level,
        details: log.details,
      })
    }

    await workbook.xlsx.writeFile(filePath)
    return { filePath, count: logs.length }
  }
}

export const exportService = new ExportService()
