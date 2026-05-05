export class DataAligner {
  constructor() {
    this.alignedData = null
  }

  align(rawData) {
    const { athletes, judgeScores, difficultyDeclarations, videoTimecodes, appeals } = rawData
    
    if (!athletes || !judgeScores) {
      throw new Error('缺少必要的数据：运动员信息或裁判分数')
    }

    const athleteMap = this.createAthleteMap(athletes)
    const scoresByAthleteEvent = this.groupScoresByAthleteEvent(judgeScores)
    const declarationsMap = this.createDeclarationsMap(difficultyDeclarations)
    const timecodesMap = this.createTimecodesMap(videoTimecodes)
    const appealsMap = this.createAppealsMap(appeals)

    const alignedAthletes = []

    for (const athlete of athleteMap.values()) {
      const athleteEvents = []
      const events = scoresByAthleteEvent.get(athlete.id) || new Map()

      for (const [eventName, eventScores] of events) {
        const eventData = this.alignEventData(
          athlete,
          eventName,
          eventScores,
          declarationsMap,
          timecodesMap,
          appealsMap
        )
        athleteEvents.push(eventData)
      }

      const totalScore = this.calculateTotalScore(athleteEvents)
      alignedAthletes.push({
        ...athlete,
        events: athleteEvents,
        totalScore,
        rank: null
      })
    }

    this.assignRanks(alignedAthletes)

    this.alignedData = {
      competition: athletes.competition || null,
      athletes: alignedAthletes,
      rawData: rawData
    }

    return this.alignedData
  }

  createAthleteMap(athletesData) {
    const map = new Map()
    const athletes = athletesData.athletes || athletesData
    for (const athlete of athletes) {
      map.set(athlete.id, {
        id: athlete.id,
        name: athlete.name,
        age: athlete.age,
        team: athlete.team,
        events: athlete.events || []
      })
    }
    return map
  }

  groupScoresByAthleteEvent(scores) {
    const athleteMap = new Map()
    for (const score of scores) {
      const athleteId = score.athlete_id
      const event = score.event

      if (!athleteMap.has(athleteId)) {
        athleteMap.set(athleteId, new Map())
      }
      const eventMap = athleteMap.get(athleteId)

      if (!eventMap.has(event)) {
        eventMap.set(event, [])
      }
      eventMap.get(event).push(score)
    }
    return athleteMap
  }

  createDeclarationsMap(declarations) {
    const map = new Map()
    if (!declarations || !declarations.declarations) return map

    for (const decl of declarations.declarations) {
      const key = `${decl.athlete_id}|${decl.event}`
      map.set(key, decl)
    }
    return map
  }

  createTimecodesMap(timecodes) {
    const map = new Map()
    if (!timecodes || !timecodes.videos) return map

    for (const video of timecodes.videos) {
      const key = `${video.athlete_id}|${video.event}`
      map.set(key, video)
    }
    return map
  }

  createAppealsMap(appeals) {
    const map = new Map()
    if (!appeals || !appeals.appeals) return map

    for (const appeal of appeals.appeals) {
      const key = `${appeal.athlete_id}|${appeal.event}`
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key).push(appeal)
    }
    return map
  }

  alignEventData(athlete, eventName, eventScores, declarationsMap, timecodesMap, appealsMap) {
    const key = `${athlete.id}|${eventName}`
    const declaration = declarationsMap.get(key)
    const video = timecodesMap.get(key)
    const eventAppeals = appealsMap.get(key) || []

    const scoreStats = this.calculateScoreStats(eventScores)
    const alignedSegments = this.alignSegments(
      athlete.id,
      eventName,
      declaration?.segments,
      video?.timecodes,
      eventAppeals
    )

    return {
      event: eventName,
      athleteId: athlete.id,
      athleteName: athlete.name,
      scores: eventScores,
      scoreStats,
      segments: alignedSegments,
      appeals: eventAppeals,
      declaration,
      video
    }
  }

  calculateScoreStats(scores) {
    if (!scores || scores.length === 0) {
      return null
    }

    const difficultyScores = scores.map(s => s.difficulty_score).filter(s => s != null)
    const executionScores = scores.map(s => s.execution_score).filter(s => s != null)
    const penaltyScores = scores.map(s => s.penalty_score).filter(s => s != null)
    const totalScores = scores.map(s => s.total_score).filter(s => s != null)

    return {
      difficulty: {
        values: difficultyScores,
        avg: this.avg(difficultyScores),
        min: Math.min(...difficultyScores),
        max: Math.max(...difficultyScores),
        variance: this.variance(difficultyScores)
      },
      execution: {
        values: executionScores,
        avg: this.avg(executionScores),
        min: Math.min(...executionScores),
        max: Math.max(...executionScores),
        variance: this.variance(executionScores)
      },
      penalty: {
        values: penaltyScores,
        avg: this.avg(penaltyScores),
        min: Math.min(...penaltyScores),
        max: Math.max(...penaltyScores)
      },
      total: {
        values: totalScores,
        avg: this.avg(totalScores),
        min: Math.min(...totalScores),
        max: Math.max(...totalScores),
        variance: this.variance(totalScores)
      },
      judgeCount: scores.length
    }
  }

  alignSegments(athleteId, eventName, declarations, timecodes, appeals) {
    const segments = []
    const segmentMap = new Map()

    if (declarations) {
      for (const decl of declarations) {
        const segmentNumber = decl.segment_number
        if (!segmentMap.has(segmentNumber)) {
          segmentMap.set(segmentNumber, {
            athleteId,
            eventName,
            segmentNumber,
            declaration: null,
            timecode: null,
            appeals: []
          })
        }
        segmentMap.get(segmentNumber).declaration = decl
      }
    }

    if (timecodes) {
      for (let i = 0; i < timecodes.length; i++) {
        const tc = timecodes[i]
        const segmentNumber = tc.segment_number || (i + 1)
        if (!segmentMap.has(segmentNumber)) {
          segmentMap.set(segmentNumber, {
            athleteId,
            eventName,
            segmentNumber,
            declaration: null,
            timecode: null,
            appeals: []
          })
        }
        segmentMap.get(segmentNumber).timecode = tc
      }
    }

    if (appeals) {
      for (const appeal of appeals) {
        if (appeal.related_segment != null) {
          const segmentNumber = appeal.related_segment
          if (segmentMap.has(segmentNumber)) {
            segmentMap.get(segmentNumber).appeals.push(appeal)
          } else {
            segmentMap.set(segmentNumber, {
              athleteId,
              eventName,
              segmentNumber,
              declaration: null,
              timecode: null,
              appeals: [appeal]
            })
          }
        }
      }
    }

    for (const [num, segment] of segmentMap) {
      segment.description = segment.declaration?.description || 
                           segment.timecode?.segment_description ||
                           `动作段 ${num}`
      segments.push(segment)
    }

    return segments.sort((a, b) => a.segmentNumber - b.segmentNumber)
  }

  calculateTotalScore(events) {
    if (!events || events.length === 0) return 0

    return events.reduce((total, event) => {
      return total + (event.scoreStats?.total?.avg || 0)
    }, 0)
  }

  assignRanks(athletes) {
    const sorted = [...athletes].sort((a, b) => b.totalScore - a.totalScore)
    let currentRank = 1
    let lastScore = null

    for (let i = 0; i < sorted.length; i++) {
      if (lastScore !== sorted[i].totalScore) {
        currentRank = i + 1
      }
      sorted[i].rank = currentRank
      lastScore = sorted[i].totalScore
    }
  }

  avg(values) {
    if (!values || values.length === 0) return 0
    return values.reduce((sum, v) => sum + v, 0) / values.length
  }

  variance(values) {
    if (!values || values.length < 2) return 0
    const avg = this.avg(values)
    const sumSq = values.reduce((sum, v) => sum + (v - avg) ** 2, 0)
    return sumSq / values.length
  }

  getAlignedData() {
    return this.alignedData
  }
}

export default DataAligner
