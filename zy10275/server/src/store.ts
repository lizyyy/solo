import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'
import * as path from 'path'
import {
  CourtSession,
  Player,
  Member,
  PlayerStatus,
  SessionStatus,
  CreateSessionRequest,
  AddPlayerRequest
} from './types'

const DATA_DIR = path.join(process.cwd(), 'data')
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json')
const MEMBERS_FILE = path.join(DATA_DIR, 'members.json')

class DataStore {
  private sessions: Map<string, CourtSession> = new Map()
  private members: Map<string, Member> = new Map()
  private memberByPhone: Map<string, Member> = new Map()
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.ensureDataDir()
    this.loadFromFile()
    
    if (this.members.size === 0 && this.sessions.size === 0) {
      this.initSampleData()
    }
    
    this.buildMemberByPhoneIndex()
    this.startAutoCheck()
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'))
        sessionsData.forEach((s: CourtSession) => {
          this.sessions.set(s.id, s)
        })
      }
      
      if (fs.existsSync(MEMBERS_FILE)) {
        const membersData = JSON.parse(fs.readFileSync(MEMBERS_FILE, 'utf-8'))
        membersData.forEach((m: Member) => {
          this.members.set(m.id, m)
        })
      }
      
      console.log(`[DataStore] 已加载数据: ${this.sessions.size} 场次, ${this.members.size} 会员`)
    } catch (error) {
      console.error('[DataStore] 加载数据失败, 将使用空数据:', error)
    }
  }

  private saveToFile(): void {
    try {
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(Array.from(this.sessions.values()), null, 2))
      fs.writeFileSync(MEMBERS_FILE, JSON.stringify(Array.from(this.members.values()), null, 2))
    } catch (error) {
      console.error('[DataStore] 保存数据失败:', error)
    }
  }

  private buildMemberByPhoneIndex(): void {
    this.members.forEach(m => {
      this.memberByPhone.set(m.phone, m)
    })
  }

  private initSampleData() {
    const sampleMembers: Member[] = [
      { id: uuidv4(), name: '张三', phone: '13800138001', isMember: true, memberDiscount: 0.9, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '李四', phone: '13800138002', isMember: true, memberDiscount: 0.85, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '王五', phone: '13800138003', isMember: false, memberDiscount: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '赵六', phone: '13800138004', isMember: true, memberDiscount: 0.9, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '钱七', phone: '13800138005', isMember: false, memberDiscount: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '孙八', phone: '13800138006', isMember: true, memberDiscount: 0.8, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '周九', phone: '13800138007', isMember: false, memberDiscount: 1, createdAt: new Date().toISOString() },
      { id: uuidv4(), name: '吴十', phone: '13800138008', isMember: true, memberDiscount: 0.95, createdAt: new Date().toISOString() },
    ]

    sampleMembers.forEach(m => {
      this.members.set(m.id, m)
      this.memberByPhone.set(m.phone, m)
    })

    const today = new Date().toISOString().split('T')[0]
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

    this.createSession({
      courtNumber: 1,
      date: today,
      startTime: '18:00',
      endTime: '20:00',
      maxPlayers: 4,
      minPlayers: 2,
      totalFee: 120,
      autoCancelIfNotEnough: true,
      cancelThresholdMinutes: 60
    })

    this.createSession({
      courtNumber: 2,
      date: today,
      startTime: '19:00',
      endTime: '21:00',
      maxPlayers: 4,
      minPlayers: 2,
      totalFee: 120,
      autoCancelIfNotEnough: true,
      cancelThresholdMinutes: 60
    })

    this.createSession({
      courtNumber: 1,
      date: tomorrow,
      startTime: '18:00',
      endTime: '20:00',
      maxPlayers: 6,
      minPlayers: 3,
      totalFee: 180,
      autoCancelIfNotEnough: true,
      cancelThresholdMinutes: 120
    })

    this.saveToFile()
    console.log('[DataStore] 已初始化样例数据')
  }

  private startAutoCheck(): void {
    this.checkInterval = setInterval(() => {
      this.checkSessionsForAutoCancel()
    }, 60000)
    console.log('[DataStore] 自动检查器已启动 (每分钟检查)')
  }

  private checkSessionsForAutoCancel(): void {
    const now = new Date()
    let cancelledCount = 0

    this.sessions.forEach(session => {
      if (session.status !== SessionStatus.OPEN && session.status !== SessionStatus.FULL) {
        return
      }
      
      if (!session.autoCancelIfNotEnough) {
        return
      }

      const sessionTime = new Date(`${session.date}T${session.startTime}`)
      const timeDiffMinutes = (sessionTime.getTime() - now.getTime()) / (1000 * 60)

      if (timeDiffMinutes <= session.cancelThresholdMinutes && timeDiffMinutes > 0) {
        const activePlayers = session.players.filter(p => p.status === PlayerStatus.CONFIRMED).length
        
        if (activePlayers < session.minPlayers) {
          session.status = SessionStatus.CANCELLED
          console.log(`[DataStore] 场次 ${session.id} 因人数不足 (${activePlayers}/${session.minPlayers}) 自动取消`)
          cancelledCount++
        }
      }
    })

    if (cancelledCount > 0) {
      this.saveToFile()
    }
  }

  private getActivePlayersCount(session: CourtSession): number {
    return session.players.filter(p => p.status === PlayerStatus.CONFIRMED).length
  }

  private updateSessionStatus(session: CourtSession): void {
    const activePlayers = this.getActivePlayersCount(session)

    if (session.status === SessionStatus.CANCELLED || session.status === SessionStatus.COMPLETED) {
      return
    }

    if (activePlayers >= session.maxPlayers) {
      session.status = SessionStatus.FULL
    } else if (activePlayers >= 0) {
      session.status = SessionStatus.OPEN
    }
  }

  public checkAndCancelIfNeeded(sessionId: string): { cancelled: boolean; reason?: string } {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { cancelled: false, reason: '场次不存在' }
    }

    if (session.status === SessionStatus.CANCELLED || session.status === SessionStatus.COMPLETED) {
      return { cancelled: false, reason: '场次已结束' }
    }

    if (!session.autoCancelIfNotEnough) {
      return { cancelled: false, reason: '未开启自动取消' }
    }

    const now = new Date()
    const sessionTime = new Date(`${session.date}T${session.startTime}`)
    const timeDiffMinutes = (sessionTime.getTime() - now.getTime()) / (1000 * 60)

    if (timeDiffMinutes <= session.cancelThresholdMinutes) {
      const activePlayers = this.getActivePlayersCount(session)
      
      if (activePlayers < session.minPlayers) {
        session.status = SessionStatus.CANCELLED
        this.saveToFile()
        return { 
          cancelled: true, 
          reason: `距离开场不足${session.cancelThresholdMinutes}分钟，人数不足(${activePlayers}/${session.minPlayers})，已自动取消` 
        }
      }
    }

    return { cancelled: false }
  }

  getOrCreateMember(name: string, phone: string, isMember: boolean = false): Member {
    let member = this.memberByPhone.get(phone)
    if (member) {
      if (member.name !== name || member.isMember !== isMember) {
        member = { ...member, name, isMember, memberDiscount: isMember ? 0.9 : 1 }
        this.members.set(member.id, member)
        this.memberByPhone.set(phone, member)
        this.saveToFile()
      }
      return member
    }

    member = {
      id: uuidv4(),
      name,
      phone,
      isMember,
      memberDiscount: isMember ? 0.9 : 1,
      createdAt: new Date().toISOString()
    }
    this.members.set(member.id, member)
    this.memberByPhone.set(phone, member)
    this.saveToFile()
    return member
  }

  getMemberById(id: string): Member | undefined {
    return this.members.get(id)
  }

  getAllMembers(): Member[] {
    return Array.from(this.members.values())
  }

  createSession(req: CreateSessionRequest): CourtSession {
    const session: CourtSession = {
      id: uuidv4(),
      courtNumber: req.courtNumber,
      date: req.date,
      startTime: req.startTime,
      endTime: req.endTime,
      maxPlayers: req.maxPlayers || 4,
      minPlayers: req.minPlayers || 2,
      totalFee: req.totalFee,
      status: SessionStatus.OPEN,
      players: [],
      waitlist: [],
      createdAt: new Date().toISOString(),
      autoCancelIfNotEnough: req.autoCancelIfNotEnough ?? true,
      cancelThresholdMinutes: req.cancelThresholdMinutes || 60
    }
    this.sessions.set(session.id, session)
    this.saveToFile()
    return session
  }

  getSession(id: string): CourtSession | undefined {
    return this.sessions.get(id)
  }

  getAllSessions(): CourtSession[] {
    return Array.from(this.sessions.values()).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      return a.startTime.localeCompare(b.startTime)
    })
  }

  private calculatePlayerFee(session: CourtSession, isMember: boolean, member: Member | undefined): number {
    const baseFee = session.totalFee / session.maxPlayers
    const discount = member?.memberDiscount || (isMember ? 0.9 : 1)
    return Math.round(baseFee * discount * 100) / 100
  }

  private isPlayerInSession(session: CourtSession, memberId: string): boolean {
    return session.players.some(p => p.memberId === memberId && p.status !== PlayerStatus.CANCELLED) ||
           session.waitlist.some(p => p.memberId === memberId)
  }

  addPlayer(sessionId: string, req: AddPlayerRequest): { session: CourtSession; player: Player; wasWaitlisted: boolean } | { error: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { error: '场次不存在' }

    if (session.status !== SessionStatus.OPEN && session.status !== SessionStatus.FULL) {
      return { error: '场次已关闭或已取消' }
    }

    const member = this.getOrCreateMember(req.memberName, req.memberPhone, req.isMember ?? false)

    if (this.isPlayerInSession(session, member.id)) {
      return { error: '该用户已在此场次中' }
    }

    const playerFee = this.calculatePlayerFee(session, member.isMember, member)

    const player: Player = {
      id: uuidv4(),
      memberId: member.id,
      memberName: member.name,
      memberPhone: member.phone,
      isMember: member.isMember,
      status: PlayerStatus.CONFIRMED,
      joinedAt: new Date().toISOString(),
      paidAmount: playerFee
    }

    let wasWaitlisted = false

    if (session.players.length >= session.maxPlayers) {
      player.status = PlayerStatus.WAITLIST
      session.waitlist.push(player)
      wasWaitlisted = true
    } else {
      session.players.push(player)
    }

    this.updateSessionStatus(session)
    this.saveToFile()

    return { session, player, wasWaitlisted }
  }

  confirmAttendance(sessionId: string, playerId: string): { session: CourtSession; player: Player } | { error: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { error: '场次不存在' }

    const player = session.players.find(p => p.id === playerId)
    if (!player) {
      const waitlistPlayer = session.waitlist.find(p => p.id === playerId)
      if (!waitlistPlayer) return { error: '球员不存在' }
      return { error: '候补球员不能直接确认到场，请先转正' }
    }

    if (player.status === PlayerStatus.CANCELLED) {
      return { error: '该球员已取消报名' }
    }

    player.confirmedAt = new Date().toISOString()
    this.saveToFile()

    return { session, player }
  }

  cancelPlayer(sessionId: string, playerId: string): { session: CourtSession; player: Player; promotedFromWaitlist: Player | null } | { error: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { error: '场次不存在' }

    let playerIndex = session.players.findIndex(p => p.id === playerId)
    let player: Player | undefined
    let isFromWaitlist = false

    if (playerIndex === -1) {
      playerIndex = session.waitlist.findIndex(p => p.id === playerId)
      if (playerIndex === -1) return { error: '球员不存在' }
      player = session.waitlist[playerIndex]
      isFromWaitlist = true
    } else {
      player = session.players[playerIndex]
    }

    if (player.status === PlayerStatus.CANCELLED || player.status === PlayerStatus.REFUNDED) {
      return { error: '该球员已取消或已退款' }
    }

    player.status = PlayerStatus.CANCELLED
    player.cancelledAt = new Date().toISOString()

    let promotedPlayer: Player | null = null
    if (!isFromWaitlist && session.waitlist.length > 0) {
      const waitlisted = session.waitlist.shift()!
      waitlisted.status = PlayerStatus.CONFIRMED
      session.players.push(waitlisted)
      promotedPlayer = waitlisted
    }

    if (isFromWaitlist) {
      session.waitlist.splice(playerIndex, 1)
    } else {
      session.players = session.players.filter(p => p.id !== playerId)
      session.players.push(player)
    }

    this.updateSessionStatus(session)
    this.saveToFile()

    return { session, player, promotedFromWaitlist: promotedPlayer }
  }

  processRefund(sessionId: string, playerId: string): { session: CourtSession; player: Player } | { error: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { error: '场次不存在' }

    const player = [...session.players, ...session.waitlist].find(p => p.id === playerId)
    if (!player) return { error: '球员不存在' }

    if (player.status !== PlayerStatus.CANCELLED) {
      return { error: '只能对已取消的球员进行退款' }
    }

    player.status = PlayerStatus.REFUNDED
    player.refundedAt = new Date().toISOString()
    player.refundAmount = player.paidAmount

    this.saveToFile()

    return { session, player }
  }

  cancelSession(sessionId: string): CourtSession | { error: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { error: '场次不存在' }

    session.status = SessionStatus.CANCELLED
    this.saveToFile()

    return session
  }

  completeSession(sessionId: string): CourtSession | { error: string } {
    const session = this.sessions.get(sessionId)
    if (!session) return { error: '场次不存在' }

    session.status = SessionStatus.COMPLETED
    this.saveToFile()

    return session
  }

  public destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }
}

export const store = new DataStore()
