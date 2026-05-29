import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { AppState, Fingering, Section, PracticeRecord, Comment, Anomaly, LearningReport } from '../types'
import { mockFingerings, mockSections, mockErrorCauses, mockPracticeRecords, mockComments } from '../data/mockData'
import { detectAllAnomalies, generateId, formatDate, formatDateTime, hashSection } from '../utils/helpers'

type Action =
  | { type: 'ADD_FINGERING'; payload: Omit<Fingering, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_FINGERING'; payload: Fingering }
  | { type: 'DELETE_FINGERING'; payload: string }
  | { type: 'ADD_SECTION'; payload: Omit<Section, 'id' | 'createdAt' | 'updatedAt' | 'previousHash'> }
  | { type: 'UPDATE_SECTION'; payload: Section }
  | { type: 'ADD_PRACTICE_RECORD'; payload: Omit<PracticeRecord, 'id' | 'createdAt'> }
  | { type: 'ADD_COMMENT'; payload: Omit<Comment, 'id' | 'createdAt' | 'updatedAt'> }
  | { type: 'UPDATE_COMMENT_STATUS'; payload: { id: string; status: Comment['status'] } }
  | { type: 'RESOLVE_ANOMALY'; payload: { id: string; note: string } }
  | { type: 'SET_CURRENT_STUDENT'; payload: string }
  | { type: 'RESCAN_ANOMALIES' }

const initialAnomalies = detectAllAnomalies(mockFingerings, mockSections, mockComments)

const initialState: AppState = {
  fingerings: mockFingerings,
  sections: mockSections,
  errorCauses: mockErrorCauses,
  practiceRecords: mockPracticeRecords,
  comments: mockComments,
  anomalies: initialAnomalies,
  currentStudent: 'student-001'
}

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_FINGERING': {
      const newFingering: Fingering = {
        ...action.payload,
        id: generateId(),
        createdAt: formatDateTime(new Date()),
        updatedAt: formatDateTime(new Date())
      }
      const newFingerings = [...state.fingerings, newFingering]
      return {
        ...state,
        fingerings: newFingerings,
        anomalies: detectAllAnomalies(newFingerings, state.sections, state.comments)
      }
    }
    case 'UPDATE_FINGERING': {
      const newFingerings = state.fingerings.map(f =>
        f.id === action.payload.id
          ? { ...action.payload, updatedAt: formatDateTime(new Date()) }
          : f
      )
      return {
        ...state,
        fingerings: newFingerings,
        anomalies: detectAllAnomalies(newFingerings, state.sections, state.comments)
      }
    }
    case 'DELETE_FINGERING': {
      const newFingerings = state.fingerings.filter(f => f.id !== action.payload)
      return {
        ...state,
        fingerings: newFingerings,
        anomalies: detectAllAnomalies(newFingerings, state.sections, state.comments)
      }
    }
    case 'ADD_SECTION': {
      const lastSection = state.sections
        .filter(s => s.scoreId === action.payload.scoreId)
        .sort((a, b) => b.sectionNumber - a.sectionNumber)[0]
      
      const newSection: Section = {
        ...action.payload,
        id: generateId(),
        createdAt: formatDateTime(new Date()),
        updatedAt: formatDateTime(new Date()),
        previousHash: lastSection ? hashSection(lastSection) : undefined
      }
      const newSections = [...state.sections, newSection]
      return {
        ...state,
        sections: newSections,
        anomalies: detectAllAnomalies(state.fingerings, newSections, state.comments)
      }
    }
    case 'UPDATE_SECTION': {
      const newSection = { ...action.payload, updatedAt: formatDateTime(new Date()), version: action.payload.version + 1 }
      const newSections = state.sections.map(s => s.id === action.payload.id ? newSection : s)
      return {
        ...state,
        sections: newSections,
        anomalies: detectAllAnomalies(state.fingerings, newSections, state.comments)
      }
    }
    case 'ADD_PRACTICE_RECORD': {
      const newRecord: PracticeRecord = {
        ...action.payload,
        id: generateId(),
        createdAt: formatDateTime(new Date())
      }
      return {
        ...state,
        practiceRecords: [...state.practiceRecords, newRecord]
      }
    }
    case 'ADD_COMMENT': {
      const newComment: Comment = {
        ...action.payload,
        id: generateId(),
        createdAt: formatDateTime(new Date()),
        updatedAt: formatDateTime(new Date())
      }
      const newComments = [...state.comments, newComment]
      return {
        ...state,
        comments: newComments,
        anomalies: detectAllAnomalies(state.fingerings, state.sections, newComments)
      }
    }
    case 'UPDATE_COMMENT_STATUS': {
      const newComments = state.comments.map(c =>
        c.id === action.payload.id
          ? { ...c, status: action.payload.status, updatedAt: formatDateTime(new Date()) }
          : c
      )
      return { ...state, comments: newComments }
    }
    case 'RESOLVE_ANOMALY': {
      return {
        ...state,
        anomalies: state.anomalies.map(a =>
          a.id === action.payload.id
            ? { ...a, resolved: true, resolutionNote: action.payload.note }
            : a
        )
      }
    }
    case 'SET_CURRENT_STUDENT':
      return { ...state, currentStudent: action.payload }
    case 'RESCAN_ANOMALIES':
      return {
        ...state,
        anomalies: detectAllAnomalies(state.fingerings, state.sections, state.comments)
      }
    default:
      return state
  }
}

interface AppContextType {
  state: AppState
  dispatch: React.Dispatch<Action>
  generateReport: (studentId: string, startDate: string, endDate: string) => LearningReport
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState)

  const generateReport = (studentId: string, startDate: string, endDate: string): LearningReport => {
    const student = state.practiceRecords.find(p => p.studentId === studentId)
    const studentName = student?.studentName || '未知学生'
    
    const filteredRecords = state.practiceRecords.filter(p =>
      p.studentId === studentId &&
      p.practiceDate >= startDate &&
      p.practiceDate <= endDate
    )

    const totalPracticeCount = filteredRecords.reduce((sum, r) => sum + r.practiceCount, 0)
    const totalDurationMinutes = filteredRecords.reduce((sum, r) => sum + r.durationMinutes, 0)
    
    const sectionsMap = new Map<string, { section: string; accuracy: number; practices: number; totalMistakes: number; totalFingerings: number }>()
    
    filteredRecords.forEach(record => {
      const section = state.sections.find(s => s.id === record.sectionId)
      if (!section) return
      
      const existing = sectionsMap.get(record.sectionId) || {
        section: record.sectionName,
        accuracy: 0,
        practices: 0,
        totalMistakes: 0,
        totalFingerings: 0
      }
      
      existing.practices += record.practiceCount
      existing.totalMistakes += record.mistakes.length
      existing.totalFingerings += section.fingeringSequence.length * record.practiceCount
      existing.accuracy = existing.totalFingerings > 0 
        ? Math.round((1 - existing.totalMistakes / existing.totalFingerings) * 100) 
        : 100
      
      sectionsMap.set(record.sectionId, existing)
    })

    const progressBySection = Array.from(sectionsMap.values())

    const mistakeCount = new Map<string, number>()
    filteredRecords.forEach(record => {
      record.mistakes.forEach(mistake => {
        const count = mistakeCount.get(mistake.errorCauseName) || 0
        mistakeCount.set(mistake.errorCauseName, count + 1)
      })
    })

    const topMistakes = Array.from(mistakeCount.entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const studentAnomalies = state.anomalies.filter(a => 
      a.sourceType === 'comment' || a.sourceType === 'practice'
    ).length

    const recommendations: string[] = []
    if (topMistakes.length > 0) {
      recommendations.push(`重点练习改进：${topMistakes[0].cause}`)
    }
    const lowAccuracySections = progressBySection.filter(s => s.accuracy < 80)
    if (lowAccuracySections.length > 0) {
      recommendations.push(`以下段落需要加强练习：${lowAccuracySections.map(s => s.section).join('、')}`)
    }
    if (totalPracticeCount < 10) {
      recommendations.push('建议增加练习频率，每周至少练习3次')
    }
    if (studentAnomalies > 0) {
      recommendations.push(`有${studentAnomalies}个异常需要关注`)
    }
    if (recommendations.length === 0) {
      recommendations.push('继续保持当前练习节奏')
    }

    return {
      id: generateId(),
      studentId,
      studentName,
      startDate,
      endDate,
      totalPracticeCount,
      totalDurationMinutes,
      sectionsCovered: progressBySection.map(s => s.section),
      topMistakes,
      progressBySection,
      anomaliesFound: studentAnomalies,
      recommendations,
      generatedAt: formatDateTime(new Date())
    }
  }

  return (
    <AppContext.Provider value={{ state, dispatch, generateReport }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider')
  }
  return context
}
