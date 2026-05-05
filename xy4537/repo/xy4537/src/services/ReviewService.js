export class ReviewService {
  constructor() {
    this.reviewNotes = new Map()
    this.storageKey = 'gymnastics_review_notes'
    this.loadFromStorage()
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        for (const [key, note] of Object.entries(data)) {
          this.reviewNotes.set(key, note)
        }
      }
    } catch (e) {
      console.warn('无法从本地存储加载复核备注:', e)
    }
  }

  saveToStorage() {
    try {
      const data = {}
      for (const [key, note] of this.reviewNotes) {
        data[key] = note
      }
      localStorage.setItem(this.storageKey, JSON.stringify(data))
    } catch (e) {
      console.warn('无法保存到本地存储:', e)
    }
  }

  generateKey(type, itemId, subId = null) {
    if (subId) {
      return `${type}|${itemId}|${subId}`
    }
    return `${type}|${itemId}`
  }

  addAppealReview(appealId, review) {
    const key = this.generateKey('appeal', appealId)
    const existing = this.reviewNotes.get(key) || {
      type: 'appeal',
      appealId,
      createdAt: new Date().toISOString(),
      reviews: []
    }

    existing.reviews.push({
      timestamp: new Date().toISOString(),
      status: review.status || 'pending',
      notes: review.notes || '',
      reviewer: review.reviewer || '复核员',
      decision: review.decision || null,
      decisionReason: review.decisionReason || '',
      scoreAdjustment: review.scoreAdjustment || null
    })

    existing.updatedAt = new Date().toISOString()
    this.reviewNotes.set(key, existing)
    this.saveToStorage()

    return existing
  }

  addIssueReview(issueType, issueId, review) {
    const key = this.generateKey('issue', `${issueType}_${issueId}`)
    const existing = this.reviewNotes.get(key) || {
      type: 'issue',
      issueType,
      issueId,
      createdAt: new Date().toISOString(),
      reviews: []
    }

    existing.reviews.push({
      timestamp: new Date().toISOString(),
      status: review.status || 'pending',
      notes: review.notes || '',
      reviewer: review.reviewer || '复核员',
      verified: review.verified || false,
      verificationDetails: review.verificationDetails || ''
    })

    existing.updatedAt = new Date().toISOString()
    this.reviewNotes.set(key, existing)
    this.saveToStorage()

    return existing
  }

  addAthleteReview(athleteId, event, segmentNumber, review) {
    const key = this.generateKey('athlete', athleteId, `${event}_${segmentNumber}`)
    const existing = this.reviewNotes.get(key) || {
      type: 'athlete',
      athleteId,
      event,
      segmentNumber,
      createdAt: new Date().toISOString(),
      reviews: []
    }

    existing.reviews.push({
      timestamp: new Date().toISOString(),
      content: review.content || '',
      tags: review.tags || [],
      reviewer: review.reviewer || '复核员'
    })

    existing.updatedAt = new Date().toISOString()
    this.reviewNotes.set(key, existing)
    this.saveToStorage()

    return existing
  }

  getAppealReview(appealId) {
    const key = this.generateKey('appeal', appealId)
    return this.reviewNotes.get(key)
  }

  getAllReviews() {
    const result = {
      appeals: [],
      issues: [],
      athletes: []
    }

    for (const [key, note] of this.reviewNotes) {
      if (note.type === 'appeal') {
        result.appeals.push(note)
      } else if (note.type === 'issue') {
        result.issues.push(note)
      } else if (note.type === 'athlete') {
        result.athletes.push(note)
      }
    }

    return result
  }

  getReviewsByAthlete(athleteId) {
    const result = []
    for (const [key, note] of this.reviewNotes) {
      if (note.athleteId === athleteId || 
          (note.appealId && note.appealId.includes(athleteId))) {
        result.push(note)
      }
    }
    return result
  }

  updateReviewStatus(type, itemId, status) {
    const key = this.generateKey(type, itemId)
    const note = this.reviewNotes.get(key)
    if (note && note.reviews && note.reviews.length > 0) {
      note.reviews[note.reviews.length - 1].status = status
      note.updatedAt = new Date().toISOString()
      this.saveToStorage()
      return note
    }
    return null
  }

  deleteReview(type, itemId) {
    const key = this.generateKey(type, itemId)
    const deleted = this.reviewNotes.delete(key)
    if (deleted) {
      this.saveToStorage()
    }
    return deleted
  }

  clearAllReviews() {
    this.reviewNotes.clear()
    try {
      localStorage.removeItem(this.storageKey)
    } catch (e) {
      console.warn('无法清除本地存储:', e)
    }
  }

  exportReviews() {
    const data = {}
    for (const [key, note] of this.reviewNotes) {
      data[key] = note
    }
    return {
      exportTime: new Date().toISOString(),
      totalReviews: this.reviewNotes.size,
      reviews: data
    }
  }

  importReviews(importData) {
    if (!importData || !importData.reviews) {
      throw new Error('无效的导入数据格式')
    }

    for (const [key, note] of Object.entries(importData.reviews)) {
      this.reviewNotes.set(key, note)
    }
    this.saveToStorage()

    return this.reviewNotes.size
  }

  getStatistics() {
    const stats = {
      total: this.reviewNotes.size,
      byType: {
        appeals: 0,
        issues: 0,
        athletes: 0
      },
      byStatus: {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        rejected: 0
      },
      lastUpdated: null
    }

    let latestDate = null
    for (const [key, note] of this.reviewNotes) {
      if (note.type === 'appeal') stats.byType.appeals++
      if (note.type === 'issue') stats.byType.issues++
      if (note.type === 'athlete') stats.byType.athletes++

      if (note.reviews && note.reviews.length > 0) {
        const lastReview = note.reviews[note.reviews.length - 1]
        const status = lastReview.status
        if (stats.byStatus[status] !== undefined) {
          stats.byStatus[status]++
        }
      }

      if (note.updatedAt || note.createdAt) {
        const reviewDate = new Date(note.updatedAt || note.createdAt)
        if (!latestDate || reviewDate > latestDate) {
          latestDate = reviewDate
        }
      }
    }

    stats.lastUpdated = latestDate ? latestDate.toISOString() : null
    return stats
  }
}

export default ReviewService
