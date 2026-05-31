import { StudentMistake, LectureSnapshot, ManualCorrection, Commentary } from '@/types';

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15);
};

const baseTime = new Date('2024-01-15T10:00:00');

const addHours = (date: Date, hours: number): string => {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
};

export const mockMistakes: StudentMistake[] = [
  {
    id: generateId(),
    studentName: '张三',
    questionId: 'GEO-2024-001',
    difficulty: 'medium',
    originalImage: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 0),
    source: 'normal',
    hasSnapshot: true
  },
  {
    id: generateId(),
    studentName: '李四',
    questionId: 'GEO-2024-002',
    difficulty: 'hard',
    originalImage: 'https://images.unsplash.com/photo-1503602642458-232111445657?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 1),
    source: 'normal',
    hasSnapshot: true
  },
  {
    id: generateId(),
    studentName: '王五',
    questionId: 'GEO-2024-001',
    difficulty: 'hard',
    originalImage: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 2),
    source: 'normal',
    hasSnapshot: true
  },
  {
    id: generateId(),
    studentName: '赵六',
    questionId: 'GEO-2024-003',
    difficulty: 'easy',
    originalImage: 'https://images.unsplash.com/photo-1596495578065-6e0763fa1178?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 3),
    source: 'late',
    hasSnapshot: false
  },
  {
    id: generateId(),
    studentName: '张三',
    questionId: 'GEO-2024-001',
    difficulty: 'medium',
    originalImage: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 4),
    source: 'normal',
    hasSnapshot: true
  },
  {
    id: generateId(),
    studentName: '钱七',
    questionId: 'GEO-2024-004',
    difficulty: 'medium',
    originalImage: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 5),
    source: 'manual',
    hasSnapshot: true
  },
  {
    id: generateId(),
    studentName: '孙八',
    questionId: 'GEO-2024-005',
    difficulty: 'hard',
    originalImage: 'https://images.unsplash.com/photo-1453733190371-0a9bedd82893?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 6),
    source: 'normal',
    hasSnapshot: false
  },
  {
    id: generateId(),
    studentName: '周九',
    questionId: 'GEO-2024-002',
    difficulty: 'medium',
    originalImage: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop',
    createdAt: addHours(baseTime, 7),
    source: 'normal',
    hasSnapshot: true
  }
];

export const mockSnapshots: LectureSnapshot[] = [
  {
    id: generateId(),
    questionId: 'GEO-2024-001',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop',
    uploader: '王老师',
    uploadTime: addHours(baseTime, 0.5),
    isLate: false
  },
  {
    id: generateId(),
    questionId: 'GEO-2024-002',
    imageUrl: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=600&h=400&fit=crop',
    uploader: '李老师',
    uploadTime: addHours(baseTime, 1.5),
    isLate: false
  },
  {
    id: generateId(),
    questionId: 'GEO-2024-004',
    imageUrl: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600&h=400&fit=crop',
    uploader: '张老师',
    uploadTime: addHours(baseTime, 10),
    isLate: true
  }
];

export const mockCorrections: ManualCorrection[] = [
  {
    id: generateId(),
    mistakeId: mockMistakes[1].id,
    operator: '教研组长',
    reason: '题目实际涉及多个辅助线构造，难度应提升',
    beforeValue: 'hard',
    afterValue: 'hard',
    correctedAt: addHours(baseTime, 3)
  },
  {
    id: generateId(),
    mistakeId: mockMistakes[2].id,
    operator: '王老师',
    reason: '经核对标准答案，该题应为中等难度',
    beforeValue: 'hard',
    afterValue: 'medium',
    correctedAt: addHours(baseTime, 4)
  },
  {
    id: generateId(),
    mistakeId: mockMistakes[5].id,
    operator: '李老师',
    reason: '人工录入时发现题目描述有误，已更正',
    beforeValue: 'medium',
    afterValue: 'hard',
    correctedAt: addHours(baseTime, 8)
  }
];

export const mockCommentaries: Commentary[] = [
  {
    id: generateId(),
    mistakeId: mockMistakes[0].id,
    content: '本题主要考察三角形中位线定理的应用。学生常见错误是未能正确识别中位线与第三边的关系。建议在讲评时重点强调辅助线的构造方法，特别是连接中点形成中位线的技巧。可以通过动画演示让学生理解中位线如何将三角形分割成两个面积相等的部分。',
    author: '王老师',
    createdAt: addHours(baseTime, 2)
  },
  {
    id: generateId(),
    mistakeId: mockMistakes[1].id,
    content: '这是一道典型的几何综合题，涉及圆的切线性质和相似三角形。学生需要掌握的关键点：1. 切线与半径垂直；2. 寻找相似三角形的对应边。错误分析显示，多数学生在第二步的相似证明上出现问题。建议补充相关的基础练习。',
    author: '李老师',
    createdAt: addHours(baseTime, 4)
  },
  {
    id: generateId(),
    mistakeId: mockMistakes[3].id,
    content: '基础题，考察勾股定理的直接应用。学生错误主要是计算失误。需要加强计算能力的训练。',
    author: '张老师',
    createdAt: addHours(baseTime, 5)
  }
];

export const getMockPackage = () => ({
  mistakes: mockMistakes,
  snapshots: mockSnapshots,
  corrections: mockCorrections,
  commentaries: mockCommentaries
});
