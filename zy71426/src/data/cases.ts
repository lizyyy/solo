import type { Case } from '../types';

export const mockCases: Case[] = [
  {
    id: 'case-001',
    title: '车辆追尾事故理赔案',
    type: 'vehicle',
    difficulty: 2,
    status: 'pending',
    accidentCard: {
      id: 'accident-001',
      caseId: 'case-001',
      mainInfo: '2024年3月15日晚8点，张先生驾驶轿车在北京市朝阳区建国路与前方车辆发生追尾事故',
      accidentTime: '2024-03-15 20:00:00',
      location: '北京市朝阳区建国路',
      description: '报案人称正常行驶中，前方车辆突然刹车导致追尾。车辆前部受损，无人员伤亡。',
      reporter: '张先生',
      claimAmount: 25000
    },
    policyClauses: [
      {
        id: 'clause-001',
        caseId: 'case-001',
        clauseNo: 'A-001',
        content: '保险期间内，被保险人或其允许的合法驾驶人在使用被保险机动车过程中，因碰撞、倾覆、坠落造成被保险机动车的损失，保险人依照本保险合同的约定负责赔偿。',
        type: 'coverage',
        isExemption: false,
        relatedEvidenceIds: ['photo-001', 'photo-002']
      },
      {
        id: 'clause-002',
        caseId: 'case-001',
        clauseNo: 'B-003',
        content: '发生意外事故时，驾驶人有以下情形之一的，保险人不负赔偿责任：（五）饮酒或服用国家管制的精神药品或麻醉药品的。',
        type: 'exemption',
        isExemption: true,
        relatedEvidenceIds: ['photo-003']
      },
      {
        id: 'clause-003',
        caseId: 'case-001',
        clauseNo: 'C-007',
        content: '被保险机动车的损失应当由第三方负责赔偿，无法找到第三方的，保险人负责赔偿，但实行30%的绝对免赔率。',
        type: 'definition',
        isExemption: false,
        relatedEvidenceIds: []
      }
    ],
    photoEvidence: [
      {
        id: 'photo-001',
        caseId: 'case-001',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=car%20front%20end%20damage%20after%20rear%20end%20collision%2C%20headlight%20broken%2C%20hood%20crumpled&image_size=square_hd',
        description: '车辆前部受损照片，可见前大灯破碎、引擎盖变形',
        shootingTime: '2024-03-15 20:15:00',
        shootingLocation: '事故现场',
        isNewDamage: true,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-002',
        caseId: 'case-001',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=car%20rear%20end%20damage%2C%20trunk%20damaged%2C%20bumper%20scratched&image_size=square_hd',
        description: '前方车辆尾部受损照片，后备箱盖凹陷',
        shootingTime: '2024-03-15 20:18:00',
        shootingLocation: '事故现场',
        isNewDamage: true,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-003',
        caseId: 'case-001',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=beer%20bottles%20on%20car%20floor%2C%20alcohol%20bottles%20inside%20vehicle&image_size=square_hd',
        description: '车内副驾驶地面上发现两个空啤酒瓶',
        shootingTime: '2024-03-15 20:25:00',
        shootingLocation: '事故现场',
        isNewDamage: null,
        contradictions: ['事故时间为晚8点，车内有酒精容器，可能涉及酒驾'],
        version: 1,
        isUpdate: false,
        updateNote: ''
      }
    ],
    materialUpdates: [
      {
        id: 'update-001',
        caseId: 'case-001',
        updateTime: '2024-03-16 10:00:00',
        updatedItems: [
          {
            type: 'photo',
            itemId: 'photo-004',
            changeType: 'new',
            diffContent: '新增：酒精检测报告，显示驾驶员血液酒精含量为85mg/100ml'
          }
        ]
      }
    ],
    correctAnswer: {
      requiredMarks: [
        {
          evidenceType: 'photo',
          evidenceId: 'photo-003',
          markType: 'exemption',
          explanation: '照片显示车内有空啤酒瓶，需标记为免责条款相关疑点'
        },
        {
          evidenceType: 'clause',
          evidenceId: 'clause-002',
          markType: 'exemption',
          explanation: 'B-003条款明确规定酒驾属于免责范围'
        },
        {
          evidenceType: 'accident',
          evidenceId: 'accident-001',
          markType: 'contradiction',
          explanation: '报案人称"正常行驶"但车内有酒精容器，存在矛盾'
        }
      ],
      riskScore: 85,
      conclusion: 'reject',
      supplementReasons: [],
      commonMistakes: [
        {
          mistakeType: '免责条款漏看',
          description: '未注意到B-003条款关于酒驾免责的规定',
          consequence: '可能错误赔付，给公司造成损失',
          ruleBasis: '《机动车交通事故责任强制保险条例》第二十二条'
        },
        {
          mistakeType: '材料矛盾未识别',
          description: '报案人陈述与现场证据（空酒瓶）存在矛盾未被发现',
          consequence: '无法发现酒驾事实，导致错赔',
          ruleBasis: '保险理赔调查规范第三章第五条'
        }
      ]
    }
  },
  {
    id: 'case-002',
    title: '小区车辆刮蹭理赔案',
    type: 'vehicle',
    difficulty: 3,
    status: 'pending',
    accidentCard: {
      id: 'accident-002',
      caseId: 'case-002',
      mainInfo: '2024年4月2日早7点，李女士发现停在小区的车辆左侧有新的刮蹭痕迹',
      accidentTime: '2024-04-02 07:00:00',
      location: '上海市浦东新区某小区停车场',
      description: '报案人称车辆昨晚停好时完好，今早发现左侧车身有新刮蹭。停车场监控损坏无法提供录像。',
      reporter: '李女士',
      claimAmount: 8000
    },
    policyClauses: [
      {
        id: 'clause-004',
        caseId: 'case-002',
        clauseNo: 'A-001',
        content: '保险期间内，被保险机动车在被保险人或其允许的合法驾驶人使用过程中，因外界物体坠落、倒塌造成被保险机动车的损失，保险人负责赔偿。',
        type: 'coverage',
        isExemption: false,
        relatedEvidenceIds: ['photo-005']
      },
      {
        id: 'clause-005',
        caseId: 'case-002',
        clauseNo: 'B-005',
        content: '被保险机动车的损失应当由第三方负责赔偿的，无法找到第三方时，保险人负责赔偿，但实行30%的绝对免赔率。',
        type: 'exemption',
        isExemption: true,
        relatedEvidenceIds: ['photo-005']
      },
      {
        id: 'clause-006',
        caseId: 'case-002',
        clauseNo: 'C-012',
        content: '本保险不负责赔偿因陈旧性损伤、自然磨损、朽蚀、故障、轮胎单独损坏造成的损失。',
        type: 'exemption',
        isExemption: true,
        relatedEvidenceIds: ['photo-006']
      }
    ],
    photoEvidence: [
      {
        id: 'photo-005',
        caseId: 'case-002',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=car%20side%20scratch%20damage%2C%20fresh%20paint%20scratch%20on%20door&image_size=square_hd',
        description: '车辆左侧车门刮蹭痕迹，可见新鲜底漆露出',
        shootingTime: '2024-04-02 07:30:00',
        shootingLocation: '小区停车场',
        isNewDamage: true,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-006',
        caseId: 'case-002',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=car%20old%20dent%20damage%20with%20rust%2C%20weathered%20scratch&image_size=square_hd',
        description: '车辆前保险杠有一处旧凹陷，边缘已有锈迹',
        shootingTime: '2024-04-02 07:35:00',
        shootingLocation: '小区停车场',
        isNewDamage: false,
        contradictions: ['此损伤边缘有锈迹，应为旧损，报案人未提及'],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-007',
        caseId: 'case-002',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=parking%20lot%20security%20camera%2C%20broken%20camera%2C%20disabled%20sign&image_size=square_hd',
        description: '停车场监控摄像头显示"设备维护中"，无法提供录像',
        shootingTime: '2024-04-02 07:40:00',
        shootingLocation: '小区停车场',
        isNewDamage: null,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      }
    ],
    materialUpdates: [
      {
        id: 'update-002',
        caseId: 'case-002',
        updateTime: '2024-04-03 14:00:00',
        updatedItems: [
          {
            type: 'photo',
            itemId: 'photo-006',
            changeType: 'duplicate',
            diffContent: '重复提交：photo-006照片（车辆前保险杠旧损），与上次提交内容完全一致'
          }
        ]
      }
    ],
    correctAnswer: {
      requiredMarks: [
        {
          evidenceType: 'photo',
          evidenceId: 'photo-006',
          markType: 'old_damage',
          explanation: '照片显示保险杠凹陷边缘有锈迹，为旧损，不在本次理赔范围内'
        },
        {
          evidenceType: 'clause',
          evidenceId: 'clause-006',
          markType: 'exemption',
          explanation: 'C-012条款明确规定陈旧性损伤不予赔偿'
        },
        {
          evidenceType: 'clause',
          evidenceId: 'clause-005',
          markType: 'exemption',
          explanation: 'B-005条款规定无法找到第三方时实行30%绝对免赔率'
        },
        {
          evidenceType: 'accident',
          evidenceId: 'accident-002',
          markType: 'suspicious',
          explanation: '报案人称"新刮蹭"但未提及保险杠旧损，存在隐瞒风险'
        }
      ],
      riskScore: 60,
      conclusion: 'supplement',
      supplementReasons: [
        '需确认本次刮蹭范围，剔除旧损部分',
        '需按条款执行30%绝对免赔率',
        '需与报案人确认旧损情况并签署声明'
      ],
      commonMistakes: [
        {
          mistakeType: '旧损当新损',
          description: '未识别出前保险杠凹陷为旧损，将其纳入本次理赔范围',
          consequence: '扩大赔付范围，造成不必要的损失',
          ruleBasis: '保险理赔定损规范第二章第三条'
        },
        {
          mistakeType: '免责条款漏看',
          description: '未正确适用无法找到第三方的30%免赔率条款',
          consequence: '赔付金额计算错误',
          ruleBasis: '机动车损失保险条款B-005'
        }
      ]
    }
  },
  {
    id: 'case-003',
    title: '家庭财产水浸理赔案',
    type: 'property',
    difficulty: 4,
    status: 'pending',
    accidentCard: {
      id: 'accident-003',
      caseId: 'case-003',
      mainInfo: '2024年5月10日，王先生家中因厨房水管爆裂造成地板、家具被水浸泡',
      accidentTime: '2024-05-10 15:30:00',
      location: '广州市天河区某小区',
      description: '报案人称上班期间家中厨房上水管爆裂，漏水浸泡客厅和卧室。装修刚完成半年。',
      reporter: '王先生',
      claimAmount: 120000
    },
    policyClauses: [
      {
        id: 'clause-007',
        caseId: 'case-003',
        clauseNo: 'A-003',
        content: '在保险期间内，由于下列原因造成保险标的的损失，保险人按照本保险合同的约定负责赔偿：（二）管道破裂及水渍。',
        type: 'coverage',
        isExemption: false,
        relatedEvidenceIds: ['photo-008', 'photo-009']
      },
      {
        id: 'clause-008',
        caseId: 'case-003',
        clauseNo: 'B-008',
        content: '因下列原因造成的损失、费用，保险人不负责赔偿：（三）保险标的本身缺陷、保管不善导致的损毁；（五）水暖管本身老化、腐蚀、锈损造成的自身损失。',
        type: 'exemption',
        isExemption: true,
        relatedEvidenceIds: ['photo-010']
      },
      {
        id: 'clause-009',
        caseId: 'case-003',
        clauseNo: 'C-015',
        content: '保险事故发生后，被保险人为防止或者减少保险标的的损失所支付的必要的、合理的费用，由保险人承担。',
        type: 'definition',
        isExemption: false,
        relatedEvidenceIds: []
      }
    ],
    photoEvidence: [
      {
        id: 'photo-008',
        caseId: 'case-003',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=water%20damaged%20wooden%20floor%2C%20swollen%20floorboards%2C%20water%20stains&image_size=square_hd',
        description: '客厅木地板被水浸泡，部分地板起翘变形',
        shootingTime: '2024-05-10 16:00:00',
        shootingLocation: '王先生家中',
        isNewDamage: true,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-009',
        caseId: 'case-003',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=burst%20water%20pipe%20under%20sink%2C%20leaking%20pipe&image_size=square_hd',
        description: '厨房水槽下水管爆裂处，可见明显裂口',
        shootingTime: '2024-05-10 16:05:00',
        shootingLocation: '王先生家中厨房',
        isNewDamage: true,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-010',
        caseId: 'case-003',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=rusty%20old%20water%20pipe%2C%20corroded%20metal%20pipe%20with%20leak&image_size=square_hd',
        description: '爆裂水管内壁有明显的锈蚀和腐蚀痕迹',
        shootingTime: '2024-05-10 16:10:00',
        shootingLocation: '王先生家中厨房',
        isNewDamage: null,
        contradictions: ['水管内壁有严重锈蚀，说明管道已老化，不属于意外爆裂'],
        version: 1,
        isUpdate: false,
        updateNote: ''
      },
      {
        id: 'photo-011',
        caseId: 'case-003',
        imageUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=water%20damaged%20furniture%2C%20swollen%20wooden%20cabinet%2C%20peeling%20paint&image_size=square_hd',
        description: '卧室衣柜底部因浸水变形，表面饰面板脱落',
        shootingTime: '2024-05-10 16:15:00',
        shootingLocation: '王先生家中卧室',
        isNewDamage: true,
        contradictions: [],
        version: 1,
        isUpdate: false,
        updateNote: ''
      }
    ],
    materialUpdates: [
      {
        id: 'update-003',
        caseId: 'case-003',
        updateTime: '2024-05-12 09:00:00',
        updatedItems: [
          {
            type: 'photo',
            itemId: 'photo-012',
            changeType: 'new',
            diffContent: '新增：房屋装修合同，显示装修时间为2020年3月，而非报案人所说的"半年"'
          },
          {
            type: 'accident',
            itemId: 'accident-003',
            changeType: 'modified',
            diffContent: '补充：经核实，该房屋装修完成时间为2020年3月，已使用4年，并非"刚完成半年"'
          }
        ]
      }
    ],
    correctAnswer: {
      requiredMarks: [
        {
          evidenceType: 'photo',
          evidenceId: 'photo-010',
          markType: 'exemption',
          explanation: '照片显示水管内壁有严重锈蚀，属于老化腐蚀导致的破裂，符合B-008免责条款'
        },
        {
          evidenceType: 'clause',
          evidenceId: 'clause-008',
          markType: 'exemption',
          explanation: 'B-008条款明确规定管道本身老化、腐蚀造成的损失不赔'
        },
        {
          evidenceType: 'accident',
          evidenceId: 'accident-003',
          markType: 'contradiction',
          explanation: '报案人称"装修刚完成半年"，但实际装修已4年，存在材料矛盾'
        },
        {
          evidenceType: 'photo',
          evidenceId: 'photo-010',
          markType: 'contradiction',
          explanation: '水管锈蚀程度与"装修刚完成半年"的陈述不符'
        }
      ],
      riskScore: 75,
      conclusion: 'supplement',
      supplementReasons: [
        '需进一步核实水管爆裂的真正原因',
        '需确认装修时间，评估是否存在虚假陈述',
        '如确认管道老化导致，应按条款B-008拒赔',
        '需与报案人确认并做笔录'
      ],
      commonMistakes: [
        {
          mistakeType: '免责条款漏看',
          description: '未注意到B-008条款关于管道本身老化腐蚀不赔的规定',
          consequence: '错误赔付本应拒赔的案件',
          ruleBasis: '家庭财产保险条款B-008'
        },
        {
          mistakeType: '材料矛盾未识别',
          description: '未发现报案人关于"装修刚完成半年"的陈述与证据之间的矛盾',
          consequence: '无法发现保险欺诈风险',
          ruleBasis: '反欺诈调查规范第四章第二条'
        }
      ]
    }
  }
];
