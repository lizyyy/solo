import { Fingering, Section, ErrorCause, PracticeRecord, Comment } from '../types'
import { generateId, formatDate, formatDateTime, hashSection } from '../utils/helpers'

const now = new Date()

export const mockFingerings: Fingering[] = [
  {
    id: 'f-gou-001',
    name: '勾',
    aliases: ['中指出', '勾弦'],
    hand: 'right',
    description: '右手中指向内拨弦',
    standardAction: '右手中指自然弯曲，指端触弦后向掌心方向拨弦，力度均匀',
    commonMistakes: ['力度过大', '触弦位置不对', '手指僵硬'],
    createdAt: formatDateTime(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-tiao-001',
    name: '挑',
    aliases: ['食指出', '挑弦'],
    hand: 'right',
    description: '右手食指向外拨弦',
    standardAction: '右手食指自然伸直，指端触弦后向外挑出，动作流畅',
    commonMistakes: ['动作太快', '指甲触弦角度不对', '力度太轻'],
    createdAt: formatDateTime(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-mo-001',
    name: '抹',
    aliases: ['食入', '抹弦'],
    hand: 'right',
    description: '右手食指向内拨弦',
    standardAction: '右手食指自然弯曲，指端触弦后向掌心方向拨弦',
    commonMistakes: ['触弦过深', '手指不放松', '速度不均'],
    createdAt: formatDateTime(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-ti-001',
    name: '剔',
    aliases: ['中出', '剔弦'],
    hand: 'right',
    description: '右手中指向外拨弦',
    standardAction: '右手中指自然伸直，指端触弦后向外剔出，干脆有力',
    commonMistakes: ['动作拖泥带水', '力度不够', '触弦点不准'],
    createdAt: formatDateTime(new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 27 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-da-001',
    name: '打',
    aliases: ['名入', '打弦'],
    hand: 'right',
    description: '右手无名指向内拨弦',
    standardAction: '右手无名指自然弯曲，指端触弦后向掌心方向拨弦',
    commonMistakes: ['无名指力度不足', '其他手指联动', '触弦位置偏差'],
    createdAt: formatDateTime(new Date(now.getTime() - 26 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 26 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-zhai-001',
    name: '摘',
    aliases: ['名出', '摘弦'],
    hand: 'right',
    description: '右手无名指向外拨弦',
    standardAction: '右手无名指自然伸直，指端触弦后向外摘出',
    commonMistakes: ['力度太轻', '动作不清晰', '无名指独立性差'],
    createdAt: formatDateTime(new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-tuo-001',
    name: '托',
    aliases: ['大出', '托弦'],
    hand: 'right',
    description: '右手大指向外拨弦',
    standardAction: '右手大指自然伸直，指端触弦后向外托出',
    commonMistakes: ['大指僵硬', '触弦角度不对', '力度不均'],
    createdAt: formatDateTime(new Date(now.getTime() - 24 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 24 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-pi-001',
    name: '擘',
    aliases: ['大入', '劈弦'],
    hand: 'right',
    description: '右手大指向内拨弦',
    standardAction: '右手大指自然弯曲，指端触弦后向掌心方向拨弦',
    commonMistakes: ['动作不自然', '力度控制差', '大指关节僵硬'],
    createdAt: formatDateTime(new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 23 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-gou-duplicate',
    name: '勾',
    aliases: ['重名勾'],
    hand: 'right',
    description: '这是一个重复的"勾"指法，用于测试同名检测',
    standardAction: '重复定义的动作',
    commonMistakes: ['这是测试数据'],
    createdAt: formatDateTime(new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 22 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'f-an-001',
    name: '按音',
    aliases: ['按弦', '左手按音'],
    hand: 'left',
    description: '左手按弦取音',
    standardAction: '左手手指按在弦上适当位置，右手弹弦得音',
    commonMistakes: ['按音位置不准', '按压力度不够', '手指移位不及时'],
    createdAt: formatDateTime(new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000))
  }
]

const section1: Section = {
  id: 's-liushui-001',
  scoreId: 'score-liushui',
  scoreName: '流水',
  sectionNumber: 1,
  sectionName: '引子',
  content: '散音起，缓缓而入，如溪水初流',
  fingeringSequence: ['f-tuo-001', 'f-mo-001', 'f-tuo-001', 'f-mo-001'],
  version: 1,
  createdAt: formatDateTime(new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)),
  updatedAt: formatDateTime(new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000))
}

const section2: Section = {
  id: 's-liushui-002',
  scoreId: 'score-liushui',
  scoreName: '流水',
  sectionNumber: 2,
  sectionName: '溪水潺潺',
  content: '节奏渐明，如溪水流动',
  fingeringSequence: ['f-gou-001', 'f-tiao-001', 'f-mo-001', 'f-ti-001', 'f-gou-001', 'f-tiao-001'],
  version: 1,
  createdAt: formatDateTime(new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000)),
  updatedAt: formatDateTime(new Date(now.getTime() - 19 * 24 * 60 * 60 * 1000)),
  previousHash: hashSection(section1)
}

const section3: Section = {
  id: 's-liushui-003',
  scoreId: 'score-liushui',
  scoreName: '流水',
  sectionNumber: 4,
  sectionName: '激流',
  content: '节奏加快，如激流奔涌',
  fingeringSequence: ['f-gou-001', 'f-gou-001', 'f-tiao-001', 'f-tiao-001', 'f-mo-001', 'f-ti-001'],
  version: 1,
  createdAt: formatDateTime(new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000)),
  updatedAt: formatDateTime(new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000)),
  previousHash: hashSection(section2)
}

const section4: Section = {
  id: 's-liushui-004',
  scoreId: 'score-liushui',
  scoreName: '流水',
  sectionNumber: 5,
  sectionName: '尾声',
  content: '渐缓渐弱，如水流远去',
  fingeringSequence: ['f-tuo-001', 'f-pi-001', 'f-da-001', 'f-zhai-001', 'f-INVALID-ID'],
  version: 1,
  createdAt: formatDateTime(new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000)),
  updatedAt: formatDateTime(new Date(now.getTime() - 17 * 24 * 60 * 60 * 1000)),
  previousHash: 'wrong-hash-value'
}

const section5: Section = {
  id: 's-pingsha-001',
  scoreId: 'score-pingsha',
  scoreName: '平沙落雁',
  sectionNumber: 1,
  sectionName: '开篇',
  content: '宁静悠远，如雁落平沙',
  fingeringSequence: ['f-tuo-001', 'f-mo-001', 'f-gou-001', 'f-tiao-001'],
  version: 1,
  createdAt: formatDateTime(new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000)),
  updatedAt: formatDateTime(new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000))
}

export const mockSections: Section[] = [section1, section2, section3, section4, section5]

export const mockErrorCauses: ErrorCause[] = [
  { id: 'ec-tech-001', code: 'TECH-001', name: '触弦位置错误', category: 'technique', description: '手指触弦的位置不正确，影响音色' },
  { id: 'ec-tech-002', code: 'TECH-002', name: '力度控制不当', category: 'technique', description: '拨弦力度过大或过小' },
  { id: 'ec-tech-003', code: 'TECH-003', name: '手指僵硬', category: 'technique', description: '手指肌肉紧张，动作不自然' },
  { id: 'ec-tech-004', code: 'TECH-004', name: '指甲角度不对', category: 'technique', description: '指甲触弦角度不正确' },
  { id: 'ec-rhy-001', code: 'RHY-001', name: '节奏不稳', category: 'rhythm', description: '节拍不准，忽快忽慢' },
  { id: 'ec-rhy-002', code: 'RHY-002', name: '抢拍', category: 'rhythm', description: '比正确节奏提前' },
  { id: 'ec-rhy-003', code: 'RHY-003', name: '拖拍', category: 'rhythm', description: '比正确节奏延后' },
  { id: 'ec-post-001', code: 'POST-001', name: '手腕姿势不对', category: 'posture', description: '手腕过高或过低' },
  { id: 'ec-post-002', code: 'POST-002', name: '坐姿不正', category: 'posture', description: '身体坐姿影响弹奏' },
  { id: 'ec-tim-001', code: 'TIM-001', name: '音色干涩', category: 'timbre', description: '发出的声音干涩无韵' },
  { id: 'ec-tim-002', code: 'TIM-002', name: '杂音过多', category: 'timbre', description: '有不必要的杂音' },
  { id: 'ec-other-001', code: 'OTHER-001', name: '其他错误', category: 'other', description: '未分类的其他错误' }
]

export const mockPracticeRecords: PracticeRecord[] = [
  {
    id: 'p-student1-001',
    studentId: 'student-001',
    studentName: '张三',
    sectionId: 's-liushui-001',
    sectionName: '引子',
    scoreName: '流水',
    practiceDate: formatDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
    practiceCount: 3,
    durationMinutes: 15,
    mistakes: [
      {
        id: 'm-001',
        fingeringId: 'f-tuo-001',
        fingeringName: '托',
        position: 1,
        errorCauseId: 'ec-tech-002',
        errorCauseName: '力度控制不当',
        severity: 'warning',
        note: '第一次托弦力度太轻',
        timestamp: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-002',
        fingeringId: 'f-mo-001',
        fingeringName: '抹',
        position: 3,
        errorCauseId: 'ec-tech-001',
        errorCauseName: '触弦位置错误',
        severity: 'critical',
        note: '抹弦时触弦过深',
        timestamp: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '感觉托的力度还是不太好控制，抹弦经常触弦太深',
    createdAt: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'p-student1-002',
    studentId: 'student-001',
    studentName: '张三',
    sectionId: 's-liushui-002',
    sectionName: '溪水潺潺',
    scoreName: '流水',
    practiceDate: formatDate(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
    practiceCount: 5,
    durationMinutes: 25,
    mistakes: [
      {
        id: 'm-003',
        fingeringId: 'f-gou-001',
        fingeringName: '勾',
        position: 1,
        errorCauseId: 'ec-tech-003',
        errorCauseName: '手指僵硬',
        severity: 'warning',
        note: '勾弦时中指不够放松',
        timestamp: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-004',
        fingeringId: 'f-tiao-001',
        fingeringName: '挑',
        position: 2,
        errorCauseId: 'ec-rhy-001',
        errorCauseName: '节奏不稳',
        severity: 'warning',
        note: '挑弦节奏有点乱',
        timestamp: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-005',
        fingeringId: 'f-ti-001',
        fingeringName: '剔',
        position: 4,
        errorCauseId: 'ec-tech-004',
        errorCauseName: '指甲角度不对',
        severity: 'critical',
        note: '剔弦指甲角度太平，音色不好',
        timestamp: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '勾挑抹剔的组合练习，剔的动作最困难',
    createdAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'p-student1-003',
    studentId: 'student-001',
    studentName: '张三',
    sectionId: 's-liushui-001',
    sectionName: '引子',
    scoreName: '流水',
    practiceDate: formatDate(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)),
    practiceCount: 4,
    durationMinutes: 20,
    mistakes: [
      {
        id: 'm-006',
        fingeringId: 'f-mo-001',
        fingeringName: '抹',
        position: 2,
        errorCauseId: 'ec-tech-001',
        errorCauseName: '触弦位置错误',
        severity: 'info',
        note: '比上次好多了，偶尔还是有点深',
        timestamp: formatDateTime(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '引子段落比上周熟练了，抹弦的问题有改善',
    createdAt: formatDateTime(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'p-student1-004',
    studentId: 'student-001',
    studentName: '张三',
    sectionId: 's-pingsha-001',
    sectionName: '开篇',
    scoreName: '平沙落雁',
    practiceDate: formatDate(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)),
    practiceCount: 3,
    durationMinutes: 18,
    mistakes: [
      {
        id: 'm-007',
        fingeringId: 'f-tuo-001',
        fingeringName: '托',
        position: 1,
        errorCauseId: 'ec-tech-002',
        errorCauseName: '力度控制不当',
        severity: 'warning',
        note: '开篇托弦应该更轻柔',
        timestamp: formatDateTime(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-008',
        fingeringId: 'f-gou-001',
        fingeringName: '勾',
        position: 3,
        errorCauseId: 'ec-tim-001',
        errorCauseName: '音色干涩',
        severity: 'warning',
        note: '音色不够圆润',
        timestamp: formatDateTime(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '平沙落雁的意境还需要体会',
    createdAt: formatDateTime(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'p-student1-005',
    studentId: 'student-001',
    studentName: '张三',
    sectionId: 's-liushui-002',
    sectionName: '溪水潺潺',
    scoreName: '流水',
    practiceDate: formatDate(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)),
    practiceCount: 6,
    durationMinutes: 30,
    mistakes: [
      {
        id: 'm-009',
        fingeringId: 'f-ti-001',
        fingeringName: '剔',
        position: 4,
        errorCauseId: 'ec-tech-004',
        errorCauseName: '指甲角度不对',
        severity: 'warning',
        note: '剔弦还是有问题，角度需要调整',
        timestamp: formatDateTime(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '剔弦的动作慢慢找到了感觉，但还是不稳定',
    createdAt: formatDateTime(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'p-student2-001',
    studentId: 'student-002',
    studentName: '李四',
    sectionId: 's-liushui-001',
    sectionName: '引子',
    scoreName: '流水',
    practiceDate: formatDate(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)),
    practiceCount: 2,
    durationMinutes: 10,
    mistakes: [
      {
        id: 'm-010',
        fingeringId: 'f-tuo-001',
        fingeringName: '托',
        position: 1,
        errorCauseId: 'ec-post-001',
        errorCauseName: '手腕姿势不对',
        severity: 'critical',
        note: '手腕太高，需要放低',
        timestamp: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-011',
        fingeringId: 'f-mo-001',
        fingeringName: '抹',
        position: 2,
        errorCauseId: 'ec-rhy-002',
        errorCauseName: '抢拍',
        severity: 'warning',
        note: '抹弦总是抢拍',
        timestamp: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '手腕姿势需要特别注意',
    createdAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000))
  },
  {
    id: 'p-student2-002',
    studentId: 'student-002',
    studentName: '李四',
    sectionId: 's-liushui-002',
    sectionName: '溪水潺潺',
    scoreName: '流水',
    practiceDate: formatDate(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)),
    practiceCount: 4,
    durationMinutes: 22,
    mistakes: [
      {
        id: 'm-012',
        fingeringId: 'f-gou-001',
        fingeringName: '勾',
        position: 1,
        errorCauseId: 'ec-tech-003',
        errorCauseName: '手指僵硬',
        severity: 'warning',
        note: '勾弦时中指僵硬',
        timestamp: formatDateTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-013',
        fingeringId: 'f-tiao-001',
        fingeringName: '挑',
        position: 2,
        errorCauseId: 'ec-tech-002',
        errorCauseName: '力度控制不当',
        severity: 'info',
        note: '挑弦力度太大',
        timestamp: formatDateTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
      },
      {
        id: 'm-014',
        fingeringId: 'f-mo-001',
        fingeringName: '抹',
        position: 3,
        errorCauseId: 'ec-rhy-003',
        errorCauseName: '拖拍',
        severity: 'warning',
        note: '抹弦拖拍了',
        timestamp: formatDateTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
      }
    ],
    selfAssessment: '节奏问题比较明显，需要多练节拍器',
    createdAt: formatDateTime(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
  }
]

export const mockComments: Comment[] = [
  {
    id: 'c-001',
    practiceRecordId: 'p-student1-001',
    studentId: 'student-001',
    teacherId: 'teacher-001',
    teacherName: '王老师',
    sectionId: 's-liushui-001',
    content: '整体不错，注意抹弦时触弦位置要准确，不要太深。建议每次练习前先做5分钟的手指放松练习。',
    status: 'reviewed',
    createdAt: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)),
    sourceMaterialRef: '流水-引子-第1-2小节'
  },
  {
    id: 'c-002',
    practiceRecordId: 'p-student1-002',
    studentId: 'student-001',
    teacherId: 'teacher-001',
    teacherName: '王老师',
    sectionId: 's-liushui-002',
    content: '剔弦的问题很关键，注意右手中指的指甲触弦角度应该是45度左右，而不是平着触弦。可以对着镜子练习，观察手指动作。',
    status: 'reviewed',
    createdAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)),
    sourceMaterialRef: '流水-溪水潺潺-第4小节'
  },
  {
    id: 'c-003',
    practiceRecordId: 'p-student1-002',
    studentId: 'student-001',
    teacherId: 'teacher-001',
    teacherName: '王老师',
    sectionId: 's-liushui-002',
    content: '补充：剔弦练习时可以先放慢速度，确保每个动作都做标准，再逐步提速。每天单独练习剔弦10分钟。',
    status: 'reviewed',
    createdAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000)),
    sourceMaterialRef: '流水-溪水潺潺-重复点评测试'
  },
  {
    id: 'c-004',
    practiceRecordId: 'p-student1-003',
    studentId: 'student-001',
    teacherId: 'teacher-001',
    teacherName: '王老师',
    sectionId: 's-liushui-001',
    content: '进步很明显！抹弦的问题确实有改善，继续保持这个练习频率。下周可以尝试加快一点速度。',
    status: 'resolved',
    createdAt: formatDateTime(new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)),
    sourceMaterialRef: '流水-引子-复习'
  },
  {
    id: 'c-005',
    practiceRecordId: 'p-student2-001',
    studentId: 'student-002',
    teacherId: 'teacher-001',
    teacherName: '王老师',
    sectionId: 's-liushui-001',
    content: '手腕姿势问题必须重视，过高的手腕会导致手指僵硬和力度控制困难。练习时注意手腕与琴面基本平行。',
    status: 'pending',
    createdAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000)),
    sourceMaterialRef: '流水-引子-手腕姿势'
  },
  {
    id: 'c-006',
    practiceRecordId: 'p-student1-005',
    studentId: 'student-001',
    teacherId: 'teacher-001',
    teacherName: '王老师',
    sectionId: 's-liushui-002',
    content: '剔弦有进步，继续保持单独练习。注意体会指甲触弦的感觉，找到那个"点"。',
    status: 'pending',
    createdAt: formatDateTime(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)),
    updatedAt: formatDateTime(new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000)),
    sourceMaterialRef: '流水-溪水潺潺-剔弦练习'
  }
]
