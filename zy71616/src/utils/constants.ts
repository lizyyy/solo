import type {
  LevelConfig,
} from '@/types'

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 'superposition',
    name: '叠加迷雾',
    type: 'superposition',
    description: '量子骰子在未被观测时，没有任何一面是确定的——它同时"是"所有面。',
    taskPrompt: '量子骰子现在处于叠加态，你认为它"确定"是几点？',
    correctAnswer: '不确定',
    answerOptions: ['1', '2', '3', '4', '5', '6', '不确定'],
    hint: '叠加态就像旋转中的硬币，在停下来之前，既不是正面也不是反面。',
    starConditions: {
      threeStar: '首次即答对',
      twoStar: '2次内答对',
      oneStar: '3次内答对',
    },
  },
  {
    id: 'measurement',
    name: '坍缩时刻',
    type: 'measurement',
    description: '一旦你"测量"了量子骰子，它就会从叠加态坍缩为一个确定的结果，而且再也不会变。',
    taskPrompt: '测量后的量子骰子，再次测量结果会变吗？',
    correctAnswer: '不会变',
    answerOptions: ['会变', '不会变', '不确定'],
    hint: '坍缩就像翻开一张扣着的牌——一旦看到，就不再是未知了。',
    starConditions: {
      threeStar: '1次测量后即答对',
      twoStar: '2次测量后答对',
      oneStar: '3次测量后答对',
    },
  },
  {
    id: 'bias',
    name: '偏差迷局',
    type: 'bias',
    description: '投的骰子越多，实验频率越接近理论概率。少量骰子的结果可能和理论差很远——这就是样本偏差。',
    taskPrompt: '用多少个骰子同时投掷，实验频率最接近理论概率1/6？',
    correctAnswer: '1000',
    answerOptions: ['1', '10', '100', '1000'],
    hint: '大数定律告诉我们：样本越大，频率越稳定。想想为什么民意调查要采访很多人？',
    starConditions: {
      threeStar: '首次即选对，且在概率板上观察到趋势',
      twoStar: '2次内选对',
      oneStar: '3次内选对',
    },
  },
]

export const TEACHER_CODE = 'quantum2026'

export const FAIR_DICE_PROBABILITY = Array(6).fill(1 / 6)

export const SAMPLE_SIZES = [1, 10, 100, 1000] as const

export const PROCESSING_CALIBER =
  '异常操作定义为：概率未归一(|sum-1|>0.01)、样本清零后统计未重置、已坍缩骰子重复测量>3次'

export const ANOMALY_DESCRIPTIONS: Record<string, string> = {
  unnormalized_probability: '概率分布之和不等于1（未归一）',
  sample_reset_error: '样本清零后实验频率统计未正确重置',
  repeated_measurement: '在已坍缩状态下进行了重复测量（>3次）',
  other: '其他异常操作',
}

export const ERROR_DESCRIPTIONS: Record<string, string> = {
  concept_superposition: '概念错误：认为叠加态有确定值',
  concept_collapse_irreversible: '概念错误：认为坍缩后结果还可以改变',
  concept_law_of_large_numbers: '概念错误：不了解大数定律，小样本就下结论',
  operation_ignored_board: '操作失误：忽略了概率板上的线索',
  operation_sample_reset: '操作失误：样本清零操作异常',
}
