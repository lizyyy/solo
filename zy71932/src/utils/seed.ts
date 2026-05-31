import { v4 as uuid } from 'uuid'
import type { FontRecord, ColorCard } from '@/types'

export function seedData(): { records: FontRecord[]; colorCards: ColorCard[] } {
  const now = new Date().toISOString()

  const colorCards: ColorCard[] = [
    {
      id: uuid(),
      name: '品牌主色卡',
      version: '2.1',
      colorValues: [
        { hex: '#1A1A2E', name: '深海蓝' },
        { hex: '#16213E', name: '午夜蓝' },
        { hex: '#0F3460', name: '靛蓝' },
        { hex: '#E94560', name: '信号红' },
      ],
      createdAt: now,
    },
    {
      id: uuid(),
      name: '辅助色卡',
      version: '1.3',
      colorValues: [
        { hex: '#F5F5F5', name: '浅灰' },
        { hex: '#333333', name: '深灰' },
        { hex: '#F59E0B', name: '琥珀' },
        { hex: '#10B981', name: '翠绿' },
      ],
      createdAt: now,
    },
    {
      id: uuid(),
      name: '品牌主色卡',
      version: '2.0',
      colorValues: [
        { hex: '#1A1A2E', name: '深海蓝' },
        { hex: '#16213E', name: '午夜蓝' },
        { hex: '#0F3460', name: '靛蓝' },
        { hex: '#D94560', name: '玫红' },
      ],
      createdAt: now,
    },
  ]

  const expiredDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const nearExpiryDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const farExpiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const records: FontRecord[] = [
    {
      id: uuid(),
      fontName: 'Noto Sans SC',
      foundry: 'Google',
      licenseType: '开源',
      expiryDate: farExpiryDate,
      usageScope: '全渠道',
      colorCardId: colorCards[0].id,
      colorCardVersion: '2.1',
      status: 'confirmed',
      reviewNotes: [],
      customNotes: '品牌主字体，SIL 开源协议',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'Helvetica Neue',
      foundry: 'Linotype',
      licenseType: '商业',
      expiryDate: farExpiryDate,
      usageScope: '印刷品+数字媒体',
      colorCardId: colorCards[0].id,
      colorCardVersion: '2.0',
      status: 'pending',
      reviewNotes: [
        { id: uuid(), content: '色卡版本需更新至 2.1', author: '审核人', createdAt: now, resolved: false },
      ],
      customNotes: '色卡版本可能不一致，待确认',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'Din Pro',
      foundry: 'FontFont',
      licenseType: '商业',
      expiryDate: expiredDate,
      usageScope: '数字媒体',
      colorCardId: colorCards[1].id,
      colorCardVersion: '1.3',
      status: 'expired',
      reviewNotes: [],
      customNotes: '授权已过期，需续期',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'Source Han Serif',
      foundry: 'Adobe',
      licenseType: '开源',
      expiryDate: farExpiryDate,
      usageScope: '全渠道',
      colorCardId: colorCards[0].id,
      colorCardVersion: '2.1',
      status: 'confirmed',
      reviewNotes: [],
      customNotes: '思源宋体，SIL 开源',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'Frutiger',
      foundry: 'Linotype',
      licenseType: '商业',
      expiryDate: nearExpiryDate,
      usageScope: '导视系统',
      colorCardId: colorCards[1].id,
      colorCardVersion: '1.3',
      status: 'pending',
      reviewNotes: [
        { id: uuid(), content: '即将到期，需安排续期', author: '设计师', createdAt: now, resolved: false },
      ],
      customNotes: '30天内到期',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'PingFang SC',
      foundry: 'Apple',
      licenseType: '个人',
      usageScope: '仅 macOS 内部使用',
      colorCardId: colorCards[2].id,
      colorCardVersion: '2.0',
      status: 'conflict',
      reviewNotes: [
        { id: uuid(), content: '色卡版本与主色卡 2.1 冲突', author: '审核人', createdAt: now, resolved: false },
      ],
      customNotes: '旧版色卡关联，版本冲突',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'Futura',
      foundry: 'URW',
      licenseType: '商业',
      colorCardId: colorCards[0].id,
      colorCardVersion: '2.1',
      status: 'pending',
      reviewNotes: [],
      customNotes: '缺少到期日',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuid(),
      fontName: 'Montserrat',
      foundry: 'Google Fonts',
      licenseType: '开源',
      expiryDate: farExpiryDate,
      usageScope: '全渠道',
      status: 'confirmed',
      reviewNotes: [],
      customNotes: 'SIL 开源，无到期限制',
      createdAt: now,
      updatedAt: now,
    },
  ]

  return { records, colorCards }
}
