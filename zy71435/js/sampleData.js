const SampleData = {
    generate() {
        const batchId = 'SAMPLE-' + formatTimestamp().replace(/[-T]/g, '').slice(0, 14);
        
        return {
            batchId: batchId,
            source: 'sample_data',
            importTime: Date.now(),
            ships: [
                {
                    id: 'SHIP-001',
                    name: '旅行者号',
                    baseVelocity: '8 km/s',
                    description: '经典深空探测器，基础速度适中',
                    _batchId: batchId
                },
                {
                    id: 'SHIP-002',
                    name: '新地平线号',
                    baseVelocity: '12 km/s',
                    description: '高速探测器，适合逃逸大质量天体',
                    _batchId: batchId
                }
            ],
            bodies: [
                {
                    id: 'BODY-001',
                    name: '月球',
                    type: 'moon',
                    mass: '7.342e22 kg',
                    radius: '1737 km',
                    description: '地球的天然卫星，逃逸速度约2.38 km/s',
                    _batchId: batchId
                },
                {
                    id: 'BODY-002',
                    name: '地球',
                    type: 'planet',
                    mass: '5.972e24 kg',
                    radius: '6371 km',
                    description: '我们的家园，逃逸速度约11.19 km/s',
                    _batchId: batchId
                },
                {
                    id: 'BODY-003',
                    name: '木星',
                    type: 'planet',
                    mass: '1 M⊕',
                    radius: '69911 km',
                    description: '太阳系最大行星，使用地球质量单位（正确）',
                    _batchId: batchId
                },
                {
                    id: 'BODY-004',
                    name: '太阳',
                    type: 'star',
                    mass: '1 M☉',
                    radius: '695700 km',
                    description: '太阳系中心恒星，使用太阳质量单位（正确）',
                    _batchId: batchId
                },
                {
                    id: 'BODY-005',
                    name: 'X行星',
                    type: 'planet',
                    mass: '5.972e24 千斤',
                    radius: '6371 km',
                    description: '质量使用"千斤"错误单位，将被标记为错误',
                    _batchId: batchId
                },
                {
                    id: 'BODY-006',
                    name: '中子星',
                    type: 'star',
                    mass: '2.8 M☉',
                    radius: '10000 m',
                    description: '超高密度恒星，逃逸速度极高',
                    _batchId: batchId
                },
                {
                    id: 'BODY-007',
                    name: '人马座A*',
                    type: 'black-hole',
                    mass: '4.3e6 M☉',
                    radius: '22000000 km',
                    description: '银河系中心超大质量黑洞',
                    _batchId: batchId
                },
                {
                    id: 'BODY-008',
                    name: '谷神星',
                    type: 'asteroid',
                    mass: '9.39e20 kg',
                    radius: '473 km',
                    description: '小行星带中最大的天体',
                    _batchId: batchId
                }
            ],
            fuels: [
                {
                    id: 'FUEL-001',
                    name: '固体火箭助推器',
                    type: 'chemical',
                    velocityBoost: '3 km/s',
                    description: '基础化学燃料，推力适中',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-002',
                    name: '液氧煤油发动机',
                    type: 'chemical',
                    velocityBoost: '5 km/s',
                    description: '高效化学燃料，常用火箭推进剂',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-003',
                    name: '核聚变推进',
                    type: 'nuclear',
                    velocityBoost: '15 km/s',
                    description: '核聚变动能，提供强大推力',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-004',
                    name: '离子推进器',
                    type: 'ion',
                    velocityBoost: '8 km/s',
                    description: '高效但推力较小，适合长时间加速',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-005',
                    name: '太阳帆',
                    type: 'solar',
                    velocityBoost: '2 km/s',
                    description: '利用光压推进，无需消耗燃料',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-006',
                    name: '反物质引擎',
                    type: 'antimatter',
                    velocityBoost: '50 km/s',
                    description: '理论最高效推进方式，推力巨大',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-007',
                    name: '冷气推进器',
                    type: 'chemical',
                    velocityBoost: '1 km/s',
                    description: '小型姿态调整推进器',
                    _batchId: batchId
                },
                {
                    id: 'FUEL-008',
                    name: '核脉冲推进',
                    type: 'nuclear',
                    velocityBoost: '30 km/s',
                    description: '猎户座计划概念，通过核爆获得推力',
                    _batchId: batchId
                }
            ],
            _meta: {
                description: '样例数据：包含正确数据、单位错误数据、不同难度天体',
                errorCases: [
                    'BODY-005: 质量单位错误（千斤）',
                    '可通过选择"朝向天体"测试方向错误',
                    '逃逸大质量天体时可测试燃料不足'
                ]
            }
        };
    },

    generateImportTemplate() {
        return {
            "$schema": "black-hole-escape-v1.json",
            "batchId": "BATCH-YYYYMMDD-XXXXXX",
            "source": "custom_import",
            "ships": [
                {
                    "id": "SHIP-001",
                    "name": "飞船名称",
                    "baseVelocity": "8 km/s",
                    "description": "飞船描述"
                }
            ],
            "bodies": [
                {
                    "id": "BODY-001",
                    "name": "天体名称",
                    "type": "planet",
                    "mass": "5.972e24 kg",
                    "radius": "6371 km",
                    "description": "天体描述"
                }
            ],
            "fuels": [
                {
                    "id": "FUEL-001",
                    "name": "燃料名称",
                    "type": "chemical",
                    "velocityBoost": "5 km/s",
                    "description": "燃料描述"
                }
            ],
            "_notes": [
                "质量单位支持: kg, 吨, M⊕(地球质量), M☉(太阳质量)",
                "长度单位支持: m, km",
                "速度单位支持: m/s, km/s",
                "天体类型: black-hole, planet, star, moon, asteroid",
                "燃料类型: chemical, nuclear, ion, solar, antimatter"
            ]
        };
    },

    getErrorCaseDescription(errorType) {
        const descriptions = {
            'mass_unit_error': {
                title: '质量单位错误',
                description: '天体质量使用了系统无法识别的单位。系统支持的质量单位包括：kg、吨、M⊕（地球质量）、M☉（太阳质量）。',
                example: '错误: "5.972e24 千斤"，正确: "5.972e24 kg" 或 "1 M⊕"',
                impact: '该天体无法计算逃逸速度，将被标记为错误数据，无法在游戏中使用'
            },
            'insufficient_fuel': {
                title: '燃料不足',
                description: '当前选择的燃料卡组合提供的总速度不足以达到逃逸速度。需要选择更多或更强的燃料卡。',
                example: '逃逸速度需要11.2 km/s，但飞船+燃料仅提供10 km/s',
                impact: '逃逸失败，本回合无法通过该天体。可以选择放弃或重新选择燃料卡'
            },
            'wrong_direction': {
                title: '速度方向错误',
                description: '推进方向选择了"朝向天体"，这会导致飞船被引力捕获，无法逃逸。',
                example: '选择了"朝向天体"方向，即使速度足够也会被引力拉向天体',
                impact: '无论速度多大，只要方向错误，逃逸必然失败'
            },
            'radius_unit_error': {
                title: '半径单位错误',
                description: '天体半径使用了系统无法识别的单位。系统支持的长度单位包括：m、km。',
                example: '错误: "6371 公里"，正确: "6371 km"',
                impact: '该天体无法计算逃逸速度，将被标记为错误数据'
            },
            'velocity_unit_error': {
                title: '速度单位错误',
                description: '飞船或燃料卡的速度使用了系统无法识别的单位。系统支持的速度单位包括：m/s、km/s。',
                example: '错误: "8 千米每秒"，正确: "8 km/s"',
                impact: '该飞船或燃料卡无法计算速度，将被标记为错误数据'
            }
        };
        return descriptions[errorType] || null;
    }
};
