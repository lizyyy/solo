import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import { initDatabase, closeDatabase } from './database'
import * as userService from './services/userService'
import * as deviceService from './services/deviceService'
import * as logService from './services/logService'
import * as retryService from './services/retryService'
import * as ioService from './services/ioService'
import {
  User,
  UserRole,
  Device,
  DeviceStatus,
  DeviceCategory,
  BorrowRecord,
  BorrowStatus,
  Permission,
  ApiResponse,
  PaginationParams,
  ExportOptions
} from '@shared/types'
import * as fs from 'fs'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  await initDatabase()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function wrapApi<T>(handler: () => Promise<T> | T): Promise<ApiResponse<T>> {
  return Promise.resolve()
    .then(handler)
    .then(data => ({ success: true, data }))
    .catch(error => ({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }))
}

ipcMain.handle('auth:login', async (_event, username: string, password: string): Promise<ApiResponse<User>> => {
  return wrapApi(async () => {
    const user = await userService.verifyUser(username, password)
    if (!user) {
      throw new Error('用户名或密码错误')
    }
    await logService.logInfo('auth', 'login', user.id, user.displayName, `用户登录`)
    return user
  })
})

ipcMain.handle('users:list', async (_event, params: PaginationParams): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await userService.listUsers(params))
})

ipcMain.handle('users:create', async (_event, data: { username: string; password: string; displayName: string; role: UserRole }): Promise<ApiResponse<User>> => {
  return wrapApi(async () => {
    return await userService.createUser(data.username, data.password, data.displayName, data.role)
  })
})

ipcMain.handle('users:update', async (_event, id: string, updates: any): Promise<ApiResponse<User | null>> => {
  return wrapApi(async () => await userService.updateUser(id, updates))
})

ipcMain.handle('users:resetPassword', async (_event, id: string, newPassword?: string): Promise<ApiResponse<string>> => {
  return wrapApi(async () => {
    const password = await userService.resetUserPassword(id, newPassword)
    const user = await userService.getUserById(id)
    if (user) {
      await logService.logInfo('auth', 'reset_password', null, null, `重置用户 ${user.username} 密码`)
    }
    return password
  })
})

ipcMain.handle('devices:list', async (_event, params: any): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await deviceService.listDevices(params))
})

ipcMain.handle('devices:get', async (_event, id: string): Promise<ApiResponse<Device | null>> => {
  return wrapApi(async () => await deviceService.getDeviceById(id))
})

ipcMain.handle('devices:create', async (_event, data: any, operator: User): Promise<ApiResponse<Device>> => {
  return wrapApi(async () => {
    const device = await deviceService.createDevice(
      data.deviceCode,
      data.name,
      data.category,
      operator,
      {
        model: data.model,
        serialNumber: data.serialNumber,
        location: data.location,
        description: data.description
      }
    )
    await logService.logInfo('device', 'create', operator.id, operator.displayName, `创建设备 ${data.deviceCode}`)
    return device
  })
})

ipcMain.handle('devices:update', async (_event, id: string, updates: any, operator: User): Promise<ApiResponse<Device | null>> => {
  return wrapApi(async () => {
    const device = await deviceService.updateDevice(id, updates, operator)
    if (device) {
      await logService.logInfo('device', 'update', operator.id, operator.displayName, `更新设备 ${device.deviceCode}`)
    }
    return device
  })
})

ipcMain.handle('devices:lend', async (_event, deviceId: string, borrowerId: string, borrowerName: string, operator: User, expectedReturnAt?: string, purpose?: string): Promise<ApiResponse<any>> => {
  return wrapApi(async () => {
    const result = await deviceService.lendDevice(deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose)
    if (result) {
      await logService.logInfo('device', 'lend', operator.id, operator.displayName, `借出设备 ${result.device.deviceCode} 给 ${borrowerName}`)
    }
    return result
  })
})

ipcMain.handle('devices:return', async (_event, deviceId: string, operator: User, notes?: string): Promise<ApiResponse<any>> => {
  return wrapApi(async () => {
    const result = await deviceService.returnDevice(deviceId, operator, notes)
    if (result) {
      await logService.logInfo('device', 'return', operator.id, operator.displayName, `归还设备 ${result.device.deviceCode}`)
    }
    return result
  })
})

ipcMain.handle('devices:changeStatus', async (_event, deviceId: string, newStatus: DeviceStatus, operator: User, notes?: string): Promise<ApiResponse<Device | null>> => {
  return wrapApi(async () => {
    const device = await deviceService.changeDeviceStatus(deviceId, newStatus, operator, notes)
    if (device) {
      await logService.logInfo('device', 'status_change', operator.id, operator.displayName, `设备状态变更 ${device.deviceCode} -> ${newStatus}`)
    }
    return device
  })
})

ipcMain.handle('devices:delete', async (_event, deviceId: string, operator: User): Promise<ApiResponse<boolean>> => {
  return wrapApi(async () => {
    const success = await deviceService.deleteDevice(deviceId, operator)
    if (success) {
      await logService.logInfo('device', 'delete', operator.id, operator.displayName, `删除设备 ID: ${deviceId}`)
    }
    return success
  })
})

ipcMain.handle('devices:history', async (_event, deviceId: string): Promise<ApiResponse<any[]>> => {
  return wrapApi(async () => await deviceService.getDeviceHistory(deviceId))
})

ipcMain.handle('devices:restore', async (_event, historyId: string, operator: User): Promise<ApiResponse<Device | null>> => {
  return wrapApi(async () => {
    const device = await deviceService.restoreDeviceFromHistory(historyId, operator)
    if (device) {
      await logService.logInfo('device', 'restore', operator.id, operator.displayName, `恢复设备 ${device.deviceCode}`)
    }
    return device
  })
})

ipcMain.handle('borrows:list', async (_event, params: any): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await deviceService.getBorrowRecords(params))
})

ipcMain.handle('logs:list', async (_event, params: any): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await logService.getLogs(params))
})

ipcMain.handle('retry:list', async (_event, params: any): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await retryService.getFailedOperations(params))
})

ipcMain.handle('retry:cancel', async (_event, id: string): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await retryService.cancelRetry(id))
})

ipcMain.handle('batch:list', async (_event, params: PaginationParams): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await ioService.getBatchOperations(params))
})

ipcMain.handle('batch:get', async (_event, id: string): Promise<ApiResponse<any>> => {
  return wrapApi(async () => await ioService.getBatchOperation(id))
})

ipcMain.handle('export:devices', async (_event, options: ExportOptions): Promise<ApiResponse<string>> => {
  return wrapApi(async () => {
    const devices = await deviceService.listDevices({
      page: 1,
      pageSize: 10000,
      ...options.filters
    })

    const exportData = devices.items.map(d => ({
      设备编号: d.deviceCode,
      设备名称: d.name,
      设备类别: d.category,
      型号: d.model,
      序列号: d.serialNumber,
      状态: d.status,
      位置: d.location,
      描述: d.description,
      当前持有人: d.currentHolderName || '',
      借出时间: d.borrowedAt || '',
      预计归还时间: d.expectedReturnAt || '',
      创建时间: d.createdAt
    }))

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出设备数据',
      defaultPath: `devices_${Date.now()}.${options.format === 'excel' ? 'xlsx' : 'csv'}`,
      filters: options.format === 'excel'
        ? [{ name: 'Excel文件', extensions: ['xlsx'] }]
        : [{ name: 'CSV文件', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      throw new Error('用户取消导出')
    }

    if (options.format === 'excel') {
      const buffer = await ioService.exportToExcel(options, () => exportData)
      fs.writeFileSync(result.filePath, buffer)
    } else {
      const csv = await ioService.exportToCSV(options, () => exportData)
      fs.writeFileSync(result.filePath, csv, 'utf-8')
    }

    return result.filePath
  })
})

ipcMain.handle('export:borrows', async (_event, options: ExportOptions): Promise<ApiResponse<string>> => {
  return wrapApi(async () => {
    const records = await deviceService.getBorrowRecords({
      page: 1,
      pageSize: 10000,
      ...options.filters
    })

    const exportData = records.items.map(r => ({
      设备编号: r.deviceCode,
      借出人: r.borrowerName,
      操作员: r.operatorName,
      借出时间: r.borrowedAt,
      预计归还时间: r.expectedReturnAt || '',
      实际归还时间: r.returnedAt || '',
      状态: r.status,
      用途: r.purpose || '',
      备注: r.notes || ''
    }))

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: '导出借出记录',
      defaultPath: `borrows_${Date.now()}.${options.format === 'excel' ? 'xlsx' : 'csv'}`,
      filters: options.format === 'excel'
        ? [{ name: 'Excel文件', extensions: ['xlsx'] }]
        : [{ name: 'CSV文件', extensions: ['csv'] }]
    })

    if (result.canceled || !result.filePath) {
      throw new Error('用户取消导出')
    }

    if (options.format === 'excel') {
      const buffer = await ioService.exportToExcel(options, () => exportData)
      fs.writeFileSync(result.filePath, buffer)
    } else {
      const csv = await ioService.exportToCSV(options, () => exportData)
      fs.writeFileSync(result.filePath, csv, 'utf-8')
    }

    return result.filePath
  })
})

ipcMain.handle('import:devices', async (_event, operator: User): Promise<ApiResponse<any>> => {
  return wrapApi(async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '导入设备数据',
      properties: ['openFile'],
      filters: [
        { name: '支持的文件', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'Excel文件', extensions: ['xlsx', 'xls'] },
        { name: 'CSV文件', extensions: ['csv'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      throw new Error('用户取消导入')
    }

    const filePath = result.filePaths[0]
    let data: any[]

    if (filePath.endsWith('.csv')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      data = ioService.parseCSV(content)
    } else {
      data = await ioService.parseExcel(filePath)
    }

    const validation = ioService.validateDeviceData(data)

    const batchOp = await ioService.createBatchOperation(
      'import_devices',
      validation.valid.length,
      operator.id,
      operator.displayName
    )

    for (const row of validation.valid) {
      try {
        const existing = await deviceService.getDeviceByCode(row.deviceCode)
        let device: Device

        if (existing) {
          device = (await deviceService.updateDevice(existing.id, {
            name: row.name,
            category: row.category,
            model: row.model,
            serialNumber: row.serialNumber,
            location: row.location,
            description: row.description
          }, operator))!
        } else {
          device = await deviceService.createDevice(
            row.deviceCode,
            row.name,
            row.category,
            operator,
            {
              model: row.model,
              serialNumber: row.serialNumber,
              location: row.location,
              description: row.description
            }
          )
        }

        await ioService.addBatchResult(batchOp.id, device.id, device.deviceCode, true)
      } catch (error) {
        await ioService.addBatchResult(
          batchOp.id,
          '',
          row.deviceCode || '',
          false,
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    const completed = await ioService.completeBatchOperation(batchOp.id)

    await logService.logInfo(
      'import',
      'devices',
      operator.id,
      operator.displayName,
      `导入设备数据: 成功 ${completed?.successCount || 0}, 失败 ${completed?.failedCount || 0}, 验证错误 ${validation.errors.length}`
    )

    return {
      batchOperation: completed,
      validationErrors: validation.errors
    }
  })
})

ipcMain.handle('batch:lend', async (_event, deviceIds: string[], borrowerId: string, borrowerName: string, operator: User, expectedReturnAt?: string, purpose?: string): Promise<ApiResponse<any>> => {
  return wrapApi(async () => {
    const batchOp = await ioService.createBatchOperation(
      'batch_lend',
      deviceIds.length,
      operator.id,
      operator.displayName
    )

    for (const deviceId of deviceIds) {
      try {
        const result = await deviceService.lendDevice(deviceId, borrowerId, borrowerName, operator, expectedReturnAt, purpose)
        if (result) {
          await ioService.addBatchResult(batchOp.id, result.device.id, result.device.deviceCode, true)
        } else {
          throw new Error('借出失败')
        }
      } catch (error) {
        const device = await deviceService.getDeviceById(deviceId)
        await ioService.addBatchResult(
          batchOp.id,
          deviceId,
          device?.deviceCode || '',
          false,
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    const completed = await ioService.completeBatchOperation(batchOp.id)

    await logService.logInfo(
      'batch',
      'lend',
      operator.id,
      operator.displayName,
      `批量借出设备: 成功 ${completed?.successCount || 0}, 失败 ${completed?.failedCount || 0}`
    )

    return completed
  })
})

ipcMain.handle('batch:return', async (_event, deviceIds: string[], operator: User): Promise<ApiResponse<any>> => {
  return wrapApi(async () => {
    const batchOp = await ioService.createBatchOperation(
      'batch_return',
      deviceIds.length,
      operator.id,
      operator.displayName
    )

    for (const deviceId of deviceIds) {
      try {
        const result = await deviceService.returnDevice(deviceId, operator)
        if (result) {
          await ioService.addBatchResult(batchOp.id, result.device.id, result.device.deviceCode, true)
        } else {
          throw new Error('归还失败')
        }
      } catch (error) {
        const device = await deviceService.getDeviceById(deviceId)
        await ioService.addBatchResult(
          batchOp.id,
          deviceId,
          device?.deviceCode || '',
          false,
          error instanceof Error ? error.message : String(error)
        )
      }
    }

    const completed = await ioService.completeBatchOperation(batchOp.id)

    await logService.logInfo(
      'batch',
      'return',
      operator.id,
      operator.displayName,
      `批量归还设备: 成功 ${completed?.successCount || 0}, 失败 ${completed?.failedCount || 0}`
    )

    return completed
  })
})
