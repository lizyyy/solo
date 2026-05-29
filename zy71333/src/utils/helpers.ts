import { Fingering, Section, Comment, Anomaly, ErrorSeverity, AnomalyType } from '../types'

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
}

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

export const formatDateTime = (date: Date): string => {
  return date.toISOString().replace('T', ' ').substr(0, 19)
}

export const createAnomaly = (
  type: AnomalyType,
  severity: ErrorSeverity,
  title: string,
  description: string,
  sourceIds: string[],
  sourceType: 'fingering' | 'section' | 'practice' | 'comment'
): Anomaly => ({
  id: generateId(),
  type,
  severity,
  title,
  description,
  sourceIds,
  sourceType,
  resolved: false,
  createdAt: formatDateTime(new Date())
})

export const detectDuplicateFingerings = (fingerings: Fingering[]): Anomaly[] => {
  const anomalies: Anomaly[] = []
  const nameMap = new Map<string, Fingering[]>()
  
  fingerings.forEach(f => {
    const allNames = [f.name, ...f.aliases].map(n => n.toLowerCase().trim())
    allNames.forEach(name => {
      if (!nameMap.has(name)) {
        nameMap.set(name, [])
      }
      nameMap.get(name)!.push(f)
    })
  })

  nameMap.forEach((matches, name) => {
    if (matches.length > 1) {
      anomalies.push(createAnomaly(
        'duplicate_name',
        'critical',
        `指法名称冲突: "${name}"`,
        `检测到 ${matches.length} 个指法使用了相同名称或别名: ${matches.map(m => m.name).join(', ')}。请合并或区分。`,
        matches.map(m => m.id),
        'fingering'
      ))
    }
  })

  return anomalies
}

export const detectSectionMismatches = (sections: Section[]): Anomaly[] => {
  const anomalies: Anomaly[] = []
  const scoreMap = new Map<string, Section[]>()

  sections.forEach(s => {
    if (!scoreMap.has(s.scoreId)) {
      scoreMap.set(s.scoreId, [])
    }
    scoreMap.get(s.scoreId)!.push(s)
  })

  scoreMap.forEach((scoreSections, scoreId) => {
    const sorted = [...scoreSections].sort((a, b) => a.sectionNumber - b.sectionNumber)
    
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].sectionNumber !== i + 1) {
        anomalies.push(createAnomaly(
          'section_mismatch',
          'warning',
          `段落序号错位: ${sorted[i].scoreName}`,
          `第${i + 1}位置的段落实际序号为${sorted[i].sectionNumber} (段落: ${sorted[i].sectionName})。可能存在缺失或重复。`,
          [sorted[i].id],
          'section'
        ))
      }
    }

    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].previousHash && sorted[i + 1].previousHash) {
        const currentHash = hashSection(sorted[i])
        if (sorted[i + 1].previousHash !== currentHash) {
          anomalies.push(createAnomaly(
            'section_mismatch',
            'critical',
            `段落版本不匹配: ${sorted[i].scoreName}`,
            `段落${sorted[i].sectionNumber}与${sorted[i + 1].sectionNumber}之间版本链断裂。${sorted[i].sectionName}可能已被修改但后续段落未同步。`,
            [sorted[i].id, sorted[i + 1].id],
            'section'
          ))
        }
      }
    }
  })

  return anomalies
}

export const detectDuplicateComments = (comments: Comment[]): Anomaly[] => {
  const anomalies: Anomaly[] = []
  const keyMap = new Map<string, Comment[]>()

  comments.forEach(c => {
    const key = `${c.studentId}-${c.sectionId}-${c.practiceRecordId}`
    if (!keyMap.has(key)) {
      keyMap.set(key, [])
    }
    keyMap.get(key)!.push(c)
  })

  keyMap.forEach((group, key) => {
    if (group.length > 1) {
      const timeSorted = [...group].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
      const firstTime = new Date(timeSorted[0].createdAt).getTime()
      const duplicates = timeSorted.filter(c => 
        new Date(c.createdAt).getTime() - firstTime < 24 * 60 * 60 * 1000
      )
      
      if (duplicates.length > 1) {
        anomalies.push(createAnomaly(
          'duplicate_comment',
          'warning',
          `重复点评检测`,
          `学生${duplicates[0].studentId}的同一次练习记录有${duplicates.length}条点评，时间间隔小于24小时。最新点评将覆盖旧点评。`,
          duplicates.map(d => d.id),
          'comment'
        ))
      }
    }
  })

  return anomalies
}

export const detectMissingFingerings = (sections: Section[], fingerings: Fingering[]): Anomaly[] => {
  const anomalies: Anomaly[] = []
  const fingeringIds = new Set(fingerings.map(f => f.id))
  const fingeringNames = new Set(fingerings.map(f => f.name.toLowerCase()))

  sections.forEach(section => {
    const missingIds = section.fingeringSequence.filter(id => !fingeringIds.has(id))
    if (missingIds.length > 0) {
      anomalies.push(createAnomaly(
        'missing_fingering',
        'critical',
        `段落引用未知指法: ${section.sectionName}`,
        `段落"${section.sectionName}"引用了${missingIds.length}个不存在的指法ID: ${missingIds.join(', ')}。请检查指法字典。`,
        [section.id],
        'section'
      ))
    }
  })

  return anomalies
}

export const hashSection = (section: Section): string => {
  const content = `${section.sectionNumber}-${section.fingeringSequence.join(',')}-${section.content}`
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(16)
}

export const detectAllAnomalies = (
  fingerings: Fingering[],
  sections: Section[],
  comments: Comment[]
): Anomaly[] => {
  return [
    ...detectDuplicateFingerings(fingerings),
    ...detectSectionMismatches(sections),
    ...detectDuplicateComments(comments),
    ...detectMissingFingerings(sections, fingerings)
  ]
}

export const exportToCSV = (data: Record<string, any>[], filename: string): void => {
  if (data.length === 0) return
  
  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const cell = row[h]
        if (typeof cell === 'string' && (cell.includes(',') || cell.includes('\n'))) {
          return `"${cell.replace(/"/g, '""')}"`
        }
        return cell
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${formatDate(new Date())}.csv`
  link.click()
}

export const exportToJSON = (data: any, filename: string): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}-${formatDate(new Date())}.json`
  link.click()
}
