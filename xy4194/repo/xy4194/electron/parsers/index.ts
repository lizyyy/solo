import fs from 'fs/promises'
import Papa from 'papaparse'
import dayjs from 'dayjs'
import type { Scene, PropStatus, ActorCall } from '../../src/types'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

// 解析场次表 CSV
export async function parseSceneSheet(filePath: string): Promise<Scene[]> {
  const fileContent = await fs.readFile(filePath, 'utf-8')
  
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const scenes: Scene[] = results.data.map((row: any, index: number) => {
          const actors = row.actors ? row.actors.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []
          const props = row.props ? row.props.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []
          const costumes = row.costumes ? row.costumes.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : []

          return {
            id: generateId(),
            sceneNumber: row.sceneNumber || row['场次号'] || `场景${index + 1}`,
            sceneName: row.sceneName || row['场景名称'] || '',
            episode: row.episode || row['集数'],
            shootDate: row.shootDate || row['拍摄日期'] || dayjs().format('YYYY-MM-DD'),
            shootTime: row.shootTime || row['拍摄时间'] || '',
            location: row.location || row['拍摄地点'] || '',
            interiorExterior: row.interiorExterior || row['内外景'] || '',
            dayNight: row.dayNight || row['日夜'] || '',
            scriptPages: parseFloat(row.scriptPages || row['剧本页数']) || 0,
            estimatedMinutes: parseFloat(row.estimatedMinutes || row['预计分钟']) || 0,
            actors,
            props,
            costumes,
            notes: row.notes || row['备注'],
            storyOrder: parseInt(row.storyOrder || row['剧情顺序']) || index + 1,
            shootOrder: parseInt(row.shootOrder || row['拍摄顺序']) || index + 1,
          }
        })

        // 按剧情顺序排序
        scenes.sort((a, b) => a.storyOrder - b.storyOrder)
        resolve(scenes)
      },
      error: (error) => {
        reject(new Error(`解析场次表失败: ${error.message}`))
      },
    })
  })
}

// 解析道具/服装状态 JSON
export async function parsePropStatus(filePath: string): Promise<PropStatus[]> {
  const fileContent = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(fileContent)
  
  // 支持数组或带data字段的对象
  const items = Array.isArray(data) ? data : (data.items || data.data || [])
  
  return items.map((item: any, index: number) => ({
    id: generateId(),
    name: item.name || item['名称'] || `道具${index + 1}`,
    type: item.type || item['类型'] || 'prop',
    sceneNumber: item.sceneNumber || item['场次号'] || '',
    actorName: item.actorName || item['演员'],
    status: item.status || item['状态'] || '',
    description: item.description || item['描述'] || '',
    photoReference: item.photoReference || item['照片引用'],
    timestamp: item.timestamp || item['记录时间'] || dayjs().toISOString(),
    recordedBy: item.recordedBy || item['记录人'] || '未知',
  }))
}

// 解析演员通告
export async function parseActorCallSheet(filePath: string): Promise<ActorCall[]> {
  // 支持CSV或JSON格式
  if (filePath.toLowerCase().endsWith('.json')) {
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(fileContent)
    const items = Array.isArray(data) ? data : (data.items || data.data || [])
    
    return items.map((item: any, index: number) => ({
      id: generateId(),
      actorName: item.actorName || item['演员姓名'] || `演员${index + 1}`,
      characterName: item.characterName || item['角色名称'] || '',
      sceneNumber: item.sceneNumber || item['场次号'] || '',
      callTime: item.callTime || item['化妆时间'] || item['callTime'] || '',
      makeupTime: item.makeupTime || item['化妆开始'] || '',
      wardrobeTime: item.wardrobeTime || item['服装时间'] || '',
      onSetTime: item.onSetTime || item['进场时间'] || '',
      shootDate: item.shootDate || item['拍摄日期'] || dayjs().format('YYYY-MM-DD'),
      costume: item.costume || item['服装'] || '',
      makeup: item.makeup || item['妆容'] || '',
      notes: item.notes || item['备注'],
    }))
  }
  
  // CSV格式
  const fileContent = await fs.readFile(filePath, 'utf-8')
  
  return new Promise((resolve, reject) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const calls: ActorCall[] = results.data.map((row: any, index: number) => ({
          id: generateId(),
          actorName: row.actorName || row['演员姓名'] || `演员${index + 1}`,
          characterName: row.characterName || row['角色名称'] || '',
          sceneNumber: row.sceneNumber || row['场次号'] || '',
          callTime: row.callTime || row['化妆时间'] || row['callTime'] || '',
          makeupTime: row.makeupTime || row['化妆开始'] || '',
          wardrobeTime: row.wardrobeTime || row['服装时间'] || '',
          onSetTime: row.onSetTime || row['进场时间'] || '',
          shootDate: row.shootDate || row['拍摄日期'] || dayjs().format('YYYY-MM-DD'),
          costume: row.costume || row['服装'] || '',
          makeup: row.makeup || row['妆容'] || '',
          notes: row.notes || row['备注'],
        }))
        resolve(calls)
      },
      error: (error) => {
        reject(new Error(`解析演员通告失败: ${error.message}`))
      },
    })
  })
}

// 扫描照片目录
export async function scanPhotoDirectory(directoryPath: string): Promise<string[]> {
  try {
    const files = await fs.readdir(directoryPath)
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff']
    
    const photoFiles = files.filter(file => {
      const ext = file.toLowerCase().substring(file.lastIndexOf('.'))
      return imageExtensions.includes(ext)
    })
    
    return photoFiles.map(file => `${directoryPath}/${file}`)
  } catch (error) {
    console.error('扫描照片目录失败:', error)
    return []
  }
}
