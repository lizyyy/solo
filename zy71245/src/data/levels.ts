import { Level } from '../types';

export const levels: Level[] = [
  {
    id: 'level-1',
    title: '《溪山行旅图》真伪鉴定',
    paintingImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=traditional%20Chinese%20ancient%20landscape%20painting%20mountain%20ink%20scroll%20song%20dynasty%20style&image_size=landscape_16_9',
    description: '据传为北宋山水名作，近期从民间征集所得，据传为范宽真迹。请通过纸张、印章、题跋等线索，鉴定此画真伪。',
    correctDynasty: 'modern-fake',
    difficulty: 2,
    clues: [
      {
        id: 'paper-1',
        category: 'paper',
        title: '画心纸张',
        description: '观察画心纸张的材质和年代特征',
        originalValue: '纸张看似为古旧宣纸，纸面有明显的做旧痕迹，纤维较短，现代机器造纸特征明显',
        isAnomaly: true,
        anomalyId: 'anomaly-paper',
        position: { x: 50, y: 50 }
      },
      {
        id: 'paper-2',
        category: 'paper',
        title: '纸张帘纹',
        description: '观察纸张帘纹特征',
        originalValue: '帘纹较宽且规律，符合宋代竹纸特征，但细看有后加工痕迹',
        isAnomaly: false
      },
      {
        id: 'seal-1',
        category: 'seal',
        title: '宣和殿宝印',
        description: '北宋内府收藏印，宋徽宗时期',
        originalValue: '印章刻工精细，但印泥颜色过于鲜艳，印文风格与徽宗朝印章典型风格不符',
        isAnomaly: true,
        anomalyId: 'anomaly-seal',
        position: { x: 80, y: 20 }
      },
      {
        id: 'seal-2',
        category: 'seal',
        title: '作者款印',
        description: '范宽款印',
        originalValue: '印文为"范宽"，篆法规整，但印泥为现代化学印泥',
        isAnomaly: true,
        anomalyId: 'anomaly-seal',
        position: { x: 15, y: 75 }
      },
      {
        id: 'calligraphy-1',
        category: 'calligraphy',
        title: '董其昌题跋',
        description: '明代著名书画家董其昌的题跋',
        originalValue: '书法风格模仿董其昌，但笔画软弱无力，字间气脉不通',
        isAnomaly: true,
        anomalyId: 'anomaly-calligraphy',
        position: { x: 50, y: 10 }
      },
      {
        id: 'calligraphy-2',
        category: 'calligraphy',
        title: '乾隆御题',
        description: '乾隆皇帝的题诗',
        originalValue: '御题诗书法水平低下，与乾隆御笔特征不符',
        isAnomaly: true,
        anomalyId: 'anomaly-calligraphy',
        position: { x: 50, y: 90 }
      },
      {
        id: 'restoration-1',
        category: 'restoration',
        title: '修复痕迹-接笔',
        description: '观察画面是否有后加笔痕迹',
        originalValue: '山腰间的树木笔触与整体风格不协调，为后加笔',
        isAnomaly: true,
        anomalyId: 'anomaly-restoration',
        position: { x: 60, y: 40 }
      },
      {
        id: 'restoration-2',
        category: 'restoration',
        title: '装裱工艺',
        description: '观察装裱方式和材料',
        originalValue: '装裱为现代日式装裱，与声称的流传经历不符',
        isAnomaly: true,
        anomalyId: 'anomaly-restoration'
      },
      {
        id: 'report-1',
        category: 'report',
        title: '碳十四检测报告',
        description: '纸张年代检测结果',
        originalValue: '检测显示纸张纤维年代约为1960-1980年间，与宋代相差近千年',
        isAnomaly: true,
        anomalyId: 'anomaly-report'
      },
      {
        id: 'report-2',
        category: 'report',
        title: '著录信息',
        description: '历代著录记载',
        originalValue: '《石渠宝笈》等重要著录中均无此画记载',
        isAnomaly: false
      }
    ],
    anomalies: [
      {
        id: 'anomaly-paper',
        name: '纸张年代不符',
        description: '纸张为现代机器造纸，非宋代古纸',
        riskLevel: 3,
        correctExplanation: '宋代纸张多为手工竹纸或麻纸，纤维细长且分布不均。此画使用的是现代机器制造的宣纸，纤维短而均匀，且有明显化学做旧痕迹。碳十四检测也证实了这一点。',
        relatedClueIds: ['paper-1', 'report-1']
      },
      {
        id: 'anomaly-seal',
        name: '印章伪造',
        description: '多方印章均为仿刻',
        riskLevel: 3,
        correctExplanation: '"宣和殿宝"印篆法与徽宗朝真印有明显差异，且使用现代化学印泥。作者款印同样疑点重重，印泥颜色和质地均为现代特征。',
        relatedClueIds: ['seal-1', 'seal-2']
      },
      {
        id: 'anomaly-calligraphy',
        name: '题跋伪作',
        description: '名人题跋均为仿写',
        riskLevel: 2,
        correctExplanation: '董其昌题跋笔画软弱，缺乏其晚年书法的生拙趣味。乾隆御题更是破绽百出，御笔书法水平远高于此。',
        relatedClueIds: ['calligraphy-1', 'calligraphy-2']
      },
      {
        id: 'anomaly-restoration',
        name: '后加笔与新装裱',
        description: '画面有后添痕迹',
        riskLevel: 2,
        correctExplanation: '山间树木为后加笔，目的是使画面更"完整"。装裱为现代工艺，与声称的"宋裱"完全不符，进一步证明其为伪作。',
        relatedClueIds: ['restoration-1', 'restoration-2']
      },
      {
        id: 'anomaly-report',
        name: '科学检测证据',
        description: '碳十四检测确认现代伪造',
        riskLevel: 3,
        correctExplanation: '碳十四检测是最直接的年代证据，纸张年代的检测结果铁证如山，证明此画制作于20世纪中后期。',
        relatedClueIds: ['report-1']
      }
    ],
    expertComments: [
      {
        id: 'expert-1',
        expertName: '张院长',
        content: '此画整体风格模仿范宽，但山石结构缺乏北宋山水的雄伟气象。最重要的是，多方印章和题跋破绽明显，结合碳十四检测结果，可以确定为现代高仿品。'
      }
    ]
  }
];
