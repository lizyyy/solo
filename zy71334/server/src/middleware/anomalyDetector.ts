import { Request, Response, NextFunction } from 'express'
import { db } from '../db/index.js'
import { rowToProblem } from '../db/index.js'
import { AnomalyInfo } from '../types.js'

export function detectChannelInvalid(channel: number, musicianName: string): AnomalyInfo | null {
  if (channel < 1 || channel > 32) {
    return {
      type: 'channel_invalid',
      reason: `通道号${channel}超出物理范围 (1-32)`,
      impact: '调音台无此通道，无法执行调音动作',
      nextAction: '请核实乐手对应的监听通道编号',
    }
  }

  const historicalChannel = db.prepare(`
    SELECT channel FROM problems 
    WHERE musician_name = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `).get(musicianName) as { channel: number } | undefined

  if (historicalChannel && historicalChannel.channel !== channel) {
    return {
      type: 'channel_invalid',
      reason: `乐手${musicianName}历史使用通道为${historicalChannel.channel}，当前填写${channel}`,
      impact: '可能导致调音到错误的通道，乐手听不到调整',
      nextAction: '确认通道是否变更，或修正通道号',
    }
  }

  return null
}

export function detectDuplicate(channel: number, description: string, excludeId?: string): AnomalyInfo | null {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60000).toISOString()
  
  let query = `
    SELECT id, description FROM problems 
    WHERE channel = ? 
      AND created_at > ?
  `
  const params: (string | number)[] = [channel, thirtyMinutesAgo]
  
  if (excludeId) {
    query += ' AND id != ?'
    params.push(excludeId)
  }

  const existingProblems = db.prepare(query).all(...params) as { id: string; description: string }[]

  for (const problem of existingProblems) {
    const similarity = calculateSimilarity(description, problem.description)
    if (similarity > 0.7) {
      return {
        type: 'duplicate',
        reason: `30分钟内通道${channel}已记录相似问题（${problem.description.substring(0, 20)}...）`,
        impact: '重复记录可能导致调音动作冲突或遗漏',
        nextAction: `建议合并到已有问题 #${problem.id.substring(0, 8)}，或确认是新问题`,
        relatedProblemIds: [problem.id],
      }
    }
  }

  return null
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '')
  const s2 = str2.toLowerCase().replace(/[^\w\u4e00-\u9fa5]/g, '')
  
  if (s1.length === 0 || s2.length === 0) return 0
  
  let matches = 0
  for (const char of s1) {
    if (s2.includes(char)) matches++
  }
  
  return matches / Math.max(s1.length, s2.length)
}

export function anomalyDetectionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'POST' && req.path === '/api/problems') {
    const { channel, musicianName, description } = req.body
    
    const anomalies: AnomalyInfo[] = []
    
    const channelAnomaly = detectChannelInvalid(channel, musicianName)
    if (channelAnomaly) anomalies.push(channelAnomaly)
    
    const duplicateAnomaly = detectDuplicate(channel, description)
    if (duplicateAnomaly) anomalies.push(duplicateAnomaly)
    
    ;(req as any).anomalies = anomalies
  }
  
  next()
}
