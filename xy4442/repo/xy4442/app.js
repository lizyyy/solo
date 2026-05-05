const STORAGE_KEY = 'acoustic_calculator_projects';
const CURRENT_PROJECT_KEY = 'acoustic_calculator_current_project';

const FREQUENCIES = [125, 250, 500, 1000, 2000, 4000];

const MATERIALS = [
    {
        id: 'concrete_unpainted',
        name: '未上漆混凝土',
        absorption: { 125: 0.01, 250: 0.01, 500: 0.02, 1000: 0.02, 2000: 0.03, 4000: 0.05 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'concrete_painted',
        name: '上漆混凝土',
        absorption: { 125: 0.01, 250: 0.01, 500: 0.02, 1000: 0.02, 2000: 0.02, 4000: 0.03 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'brick_rough',
        name: '粗糙砖墙',
        absorption: { 125: 0.03, 250: 0.03, 500: 0.03, 1000: 0.04, 2000: 0.05, 4000: 0.07 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'brick_painted',
        name: '上漆砖墙',
        absorption: { 125: 0.01, 250: 0.01, 500: 0.02, 1000: 0.02, 2000: 0.02, 4000: 0.03 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'plaster',
        name: '灰泥/石膏墙',
        absorption: { 125: 0.02, 250: 0.02, 500: 0.03, 1000: 0.04, 2000: 0.05, 4000: 0.05 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'glass_thin',
        name: '薄玻璃窗',
        absorption: { 125: 0.08, 250: 0.04, 500: 0.03, 1000: 0.03, 2000: 0.02, 4000: 0.02 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'glass_thick',
        name: '厚玻璃窗',
        absorption: { 125: 0.05, 250: 0.03, 500: 0.02, 1000: 0.02, 2000: 0.02, 4000: 0.02 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'wood_panel_hard',
        name: '硬质木墙板',
        absorption: { 125: 0.08, 250: 0.06, 500: 0.04, 1000: 0.03, 2000: 0.02, 4000: 0.02 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'wood_panel_soft',
        name: '软质木墙板',
        absorption: { 125: 0.12, 250: 0.10, 500: 0.08, 1000: 0.06, 2000: 0.05, 4000: 0.04 },
        price: 0,
        category: 'structural'
    },
    {
        id: 'concrete_floor',
        name: '混凝土地面',
        absorption: { 125: 0.01, 250: 0.01, 500: 0.02, 1000: 0.02, 2000: 0.03, 4000: 0.03 },
        price: 0,
        category: 'floor'
    },
    {
        id: 'wood_floor',
        name: '木地板',
        absorption: { 125: 0.04, 250: 0.04, 500: 0.03, 1000: 0.03, 2000: 0.02, 4000: 0.02 },
        price: 0,
        category: 'floor'
    },
    {
        id: 'tile_floor',
        name: '瓷砖地面',
        absorption: { 125: 0.01, 250: 0.01, 500: 0.01, 1000: 0.02, 2000: 0.02, 4000: 0.02 },
        price: 0,
        category: 'floor'
    },
    {
        id: 'carpet_thin',
        name: '薄地毯（无垫）',
        absorption: { 125: 0.04, 250: 0.05, 500: 0.10, 1000: 0.20, 2000: 0.30, 4000: 0.40 },
        price: 0,
        category: 'floor'
    },
    {
        id: 'carpet_thick',
        name: '厚地毯（带垫）',
        absorption: { 125: 0.08, 250: 0.12, 500: 0.25, 1000: 0.45, 2000: 0.60, 4000: 0.70 },
        price: 0,
        category: 'floor'
    },
    {
        id: 'acoustic_foam_25mm',
        name: '吸音海绵 25mm',
        absorption: { 125: 0.05, 250: 0.15, 500: 0.40, 1000: 0.75, 2000: 0.90, 4000: 0.95 },
        price: 80,
        category: 'treatment'
    },
    {
        id: 'acoustic_foam_50mm',
        name: '吸音海绵 50mm',
        absorption: { 125: 0.15, 250: 0.30, 500: 0.60, 1000: 0.85, 2000: 0.95, 4000: 0.98 },
        price: 150,
        category: 'treatment'
    },
    {
        id: 'acoustic_foam_100mm',
        name: '吸音海绵 100mm',
        absorption: { 125: 0.35, 250: 0.55, 500: 0.80, 1000: 0.90, 2000: 0.95, 4000: 0.98 },
        price: 250,
        category: 'treatment'
    },
    {
        id: 'fiberglass_panel_25mm',
        name: '玻璃棉板 25mm',
        absorption: { 125: 0.07, 250: 0.20, 500: 0.50, 1000: 0.80, 2000: 0.90, 4000: 0.95 },
        price: 60,
        category: 'treatment'
    },
    {
        id: 'fiberglass_panel_50mm',
        name: '玻璃棉板 50mm',
        absorption: { 125: 0.20, 250: 0.40, 500: 0.70, 1000: 0.90, 2000: 0.95, 4000: 0.98 },
        price: 100,
        category: 'treatment'
    },
    {
        id: 'fiberglass_panel_100mm',
        name: '玻璃棉板 100mm',
        absorption: { 125: 0.45, 250: 0.65, 500: 0.85, 1000: 0.95, 2000: 0.98, 4000: 0.99 },
        price: 180,
        category: 'treatment'
    },
    {
        id: 'bass_trap_corner',
        name: '墙角低音陷阱',
        absorption: { 125: 0.40, 250: 0.60, 500: 0.80, 1000: 0.90, 2000: 0.95, 4000: 0.98 },
        price: 300,
        category: 'treatment'
    },
    {
        id: 'wooden_bass_trap',
        name: '木质共振器低音陷阱',
        absorption: { 125: 0.60, 250: 0.40, 500: 0.20, 1000: 0.10, 2000: 0.05, 4000: 0.03 },
        price: 500,
        category: 'treatment'
    },
    {
        id: 'fabric_wrapped_panel',
        name: '布艺吸音板',
        absorption: { 125: 0.15, 250: 0.30, 500: 0.60, 1000: 0.85, 2000: 0.90, 4000: 0.95 },
        price: 200,
        category: 'treatment'
    },
    {
        id: 'perforated_panel',
        name: '穿孔吸音板',
        absorption: { 125: 0.25, 250: 0.45, 500: 0.65, 1000: 0.75, 2000: 0.70, 4000: 0.65 },
        price: 250,
        category: 'treatment'
    },
    {
        id: 'diffuser_quadratic',
        name: '二次余数扩散体',
        absorption: { 125: 0.05, 250: 0.10, 500: 0.15, 1000: 0.15, 2000: 0.10, 4000: 0.08 },
        price: 400,
        category: 'treatment'
    },
    {
        id: 'heavy_curtain',
        name: '厚重窗帘',
        absorption: { 125: 0.05, 250: 0.10, 500: 0.20, 1000: 0.35, 2000: 0.45, 4000: 0.50 },
        price: 0,
        category: 'other'
    },
    {
        id: 'curtain_heavy',
        name: '重型舞台幕布',
        absorption: { 125: 0.10, 250: 0.20, 500: 0.35, 1000: 0.50, 2000: 0.60, 4000: 0.65 },
        price: 0,
        category: 'other'
    }
];

const FURNITURE_TYPES = [
    {
        id: 'sofa',
        name: '沙发',
        absorption: { 125: 0.20, 250: 0.30, 500: 0.40, 1000: 0.45, 2000: 0.50, 4000: 0.55 },
        defaultArea: 2.0
    },
    {
        id: 'chair_upholstered',
        name: '布艺椅子',
        absorption: { 125: 0.15, 250: 0.25, 500: 0.35, 1000: 0.40, 2000: 0.45, 4000: 0.50 },
        defaultArea: 0.8
    },
    {
        id: 'chair_wooden',
        name: '木椅',
        absorption: { 125: 0.05, 250: 0.05, 500: 0.03, 1000: 0.02, 2000: 0.02, 4000: 0.02 },
        defaultArea: 0.5
    },
    {
        id: 'desk_wooden',
        name: '木桌',
        absorption: { 125: 0.05, 250: 0.05, 500: 0.04, 1000: 0.03, 2000: 0.02, 4000: 0.02 },
        defaultArea: 1.5
    },
    {
        id: 'bookshelf_full',
        name: '满装书架',
        absorption: { 125: 0.20, 250: 0.30, 500: 0.40, 1000: 0.50, 2000: 0.55, 4000: 0.60 },
        defaultArea: 2.0
    },
    {
        id: 'cabinet_wooden',
        name: '木质橱柜',
        absorption: { 125: 0.05, 250: 0.06, 500: 0.07, 1000: 0.08, 2000: 0.09, 4000: 0.10 },
        defaultArea: 2.0
    },
    {
        id: 'plant_large',
        name: '大型植物',
        absorption: { 125: 0.05, 250: 0.10, 500: 0.15, 1000: 0.20, 2000: 0.25, 4000: 0.30 },
        defaultArea: 0.5
    },
    {
        id: 'bed',
        name: '床',
        absorption: { 125: 0.15, 250: 0.25, 500: 0.35, 1000: 0.40, 2000: 0.45, 4000: 0.50 },
        defaultArea: 2.0
    },
    {
        id: 'custom',
        name: '自定义',
        absorption: { 125: 0.10, 250: 0.15, 500: 0.20, 1000: 0.25, 2000: 0.30, 4000: 0.35 },
        defaultArea: 1.0
    }
];

let currentProject = null;
let projects = {};
let pulseData = null;

const defaultProject = {
    id: '',
    name: '新建方案',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    room: {
        length: '',
        width: '',
        height: ''
    },
    surfaces: {
        wall: { material: '', area: '', coverage: '', newMaterial: '' },
        floor: { material: '', area: '', coverage: '', newMaterial: '' },
        ceiling: { material: '', area: '', coverage: '', newMaterial: '' }
    },
    furniture: [],
    budgetLimit: '',
    notes: '',
    pulseData: null
};

function getMaterialById(id) {
    return MATERIALS.find(m => m.id === id);
}

function getFurnitureTypeById(id) {
    return FURNITURE_TYPES.find(f => f.id === id);
}

function calculateRoomVolume(length, width, height) {
    return length * width * height;
}

function calculateSurfaceArea(length, width, height) {
    const wallArea = 2 * (length + width) * height;
    const floorArea = length * width;
    const ceilingArea = length * width;
    return {
        wall: wallArea,
        floor: floorArea,
        ceiling: ceilingArea
    };
}

function calculateStandingWaves(length, width, height) {
    const speedOfSound = 343;
    const waves = {
        axial: [],
        tangential: [],
        oblique: []
    };

    for (let n = 1; n <= 5; n++) {
        waves.axial.push({
            axis: '长度',
            dimension: 'L',
            value: length,
            harmonic: n,
            frequency: (n * speedOfSound) / (2 * length)
        });
        waves.axial.push({
            axis: '宽度',
            dimension: 'W',
            value: width,
            harmonic: n,
            frequency: (n * speedOfSound) / (2 * width)
        });
        waves.axial.push({
            axis: '高度',
            dimension: 'H',
            value: height,
            harmonic: n,
            frequency: (n * speedOfSound) / (2 * height)
        });
    }

    for (let n = 1; n <= 3; n++) {
        for (let m = 1; m <= 3; m++) {
            waves.tangential.push({
                dimensions: 'L+W',
                harmonic: `${n},${m}`,
                frequency: (speedOfSound / 2) * Math.sqrt(Math.pow(n / length, 2) + Math.pow(m / width, 2))
            });
            waves.tangential.push({
                dimensions: 'L+H',
                harmonic: `${n},${m}`,
                frequency: (speedOfSound / 2) * Math.sqrt(Math.pow(n / length, 2) + Math.pow(m / height, 2))
            });
            waves.tangential.push({
                dimensions: 'W+H',
                harmonic: `${n},${m}`,
                frequency: (speedOfSound / 2) * Math.sqrt(Math.pow(n / width, 2) + Math.pow(m / height, 2))
            });
        }
    }

    for (let n = 1; n <= 2; n++) {
        for (let m = 1; m <= 2; m++) {
            for (let p = 1; p <= 2; p++) {
                waves.oblique.push({
                    dimensions: 'L+W+H',
                    harmonic: `${n},${m},${p}`,
                    frequency: (speedOfSound / 2) * Math.sqrt(
                        Math.pow(n / length, 2) + 
                        Math.pow(m / width, 2) + 
                        Math.pow(p / height, 2)
                    )
                });
            }
        }
    }

    return waves;
}

function analyzeStandingWaveRisk(waves, volume) {
    const allFrequencies = [
        ...waves.axial.map(w => ({ ...w, type: 'axial', level: 1 })),
        ...waves.tangential.map(w => ({ ...w, type: 'tangential', level: 2 })),
        ...waves.oblique.map(w => ({ ...w, type: 'oblique', level: 3 }))
    ].filter(w => w.frequency >= 20 && w.frequency <= 300);

    const clashes = [];
    const tolerance = 5;

    for (let i = 0; i < allFrequencies.length; i++) {
        for (let j = i + 1; j < allFrequencies.length; j++) {
            const diff = Math.abs(allFrequencies[i].frequency - allFrequencies[j].frequency);
            if (diff < tolerance && diff > 0) {
                clashes.push({
                    freq1: allFrequencies[i],
                    freq2: allFrequencies[j],
                    difference: diff
                });
            }
        }
    }

    const lowFreqAxial = waves.axial.filter(w => w.frequency >= 20 && w.frequency <= 200);
    const hasStrongModes = lowFreqAxial.some(w => w.harmonic <= 2);

    let riskLevel = 'low';
    let riskDescription = '';

    if (clashes.length >= 3 || (hasStrongModes && clashes.length >= 2)) {
        riskLevel = 'high';
        riskDescription = '存在高驻波风险，建议进行声学处理或考虑调整房间尺寸比例。';
    } else if (clashes.length >= 1 || hasStrongModes) {
        riskLevel = 'medium';
        riskDescription = '存在一定驻波风险，建议在低频区域加强声学处理。';
    } else {
        riskLevel = 'low';
        riskDescription = '房间尺寸比例良好，驻波风险较低。';
    }

    return {
        waves: allFrequencies,
        clashes,
        riskLevel,
        riskDescription,
        lowFreqModes: lowFreqAxial
    };
}

function calculateRT60(volume, surfaceAbsorption, frequency) {
    const S = surfaceAbsorption.totalArea || 0;
    const A = surfaceAbsorption.totalAbsorption || 0;

    if (A <= 0 || S <= 0) {
        return null;
    }

    const RT60 = 0.161 * volume / A;

    if (RT60 > 10) return 10;
    if (RT60 < 0.1) return 0.1;

    return RT60;
}

function getTargetRT60(volume, isRecordingStudio = true) {
    let baseTarget;
    
    if (volume < 30) {
        baseTarget = 0.3;
    } else if (volume < 50) {
        baseTarget = 0.4;
    } else if (volume < 100) {
        baseTarget = 0.5;
    } else if (volume < 200) {
        baseTarget = 0.6;
    } else {
        baseTarget = 0.7;
    }

    return {
        125: baseTarget * 1.3,
        250: baseTarget * 1.1,
        500: baseTarget,
        1000: baseTarget,
        2000: baseTarget * 0.9,
        4000: baseTarget * 0.8
    };
}

function calculateSurfaceAbsorption(surfaces, furniture, isAfterTreatment = false) {
    const absorption = {};
    let totalArea = 0;
    let totalAbsorption = 0;

    FREQUENCIES.forEach(freq => {
        absorption[freq] = 0;
    });

    ['wall', 'floor', 'ceiling'].forEach(surfaceType => {
        const surface = surfaces[surfaceType];
        const area = parseFloat(surface.area) || 0;
        totalArea += area;

        let materialId = surface.material;
        
        if (isAfterTreatment && surface.newMaterial && surface.coverage > 0) {
            const coverage = parseFloat(surface.coverage) || 0;
            const oldMaterial = getMaterialById(surface.material);
            const newMaterial = getMaterialById(surface.newMaterial);

            if (newMaterial && oldMaterial) {
                const remainingArea = area - coverage;
                
                FREQUENCIES.forEach(freq => {
                    absorption[freq] += remainingArea * (oldMaterial.absorption[freq] || 0);
                    absorption[freq] += coverage * (newMaterial.absorption[freq] || 0);
                });
                return;
            }
        }

        const material = getMaterialById(materialId);
        if (material) {
            FREQUENCIES.forEach(freq => {
                absorption[freq] += area * (material.absorption[freq] || 0);
            });
        }
    });

    furniture.forEach(item => {
        const type = getFurnitureTypeById(item.type);
        if (type) {
            const area = parseFloat(item.area) || type.defaultArea;
            FREQUENCIES.forEach(freq => {
                absorption[freq] += area * (type.absorption[freq] || 0);
            });
            totalArea += area;
        }
    });

    FREQUENCIES.forEach(freq => {
        totalAbsorption += absorption[freq];
    });

    return {
        byFrequency: absorption,
        totalArea,
        totalAbsorption: totalAbsorption / FREQUENCIES.length
    };
}

function calculateBudget(surfaces) {
    const items = [];
    let total = 0;

    ['wall', 'floor', 'ceiling'].forEach(surfaceType => {
        const surface = surfaces[surfaceType];
        if (surface.newMaterial && surface.coverage > 0) {
            const material = getMaterialById(surface.newMaterial);
            const coverage = parseFloat(surface.coverage) || 0;
            
            if (material && material.price > 0) {
                const cost = coverage * material.price;
                total += cost;
                items.push({
                    surface: { wall: '墙面', floor: '地面', ceiling: '天花板' }[surfaceType],
                    material: material.name,
                    area: coverage,
                    unitPrice: material.price,
                    cost: cost
                });
            }
        }
    });

    return {
        items,
        total
    };
}

function analyzeResults(project, results) {
    const warnings = [];
    const suggestions = [];

    if (results.standingWave) {
        if (results.standingWave.riskLevel === 'high') {
            warnings.push({
                type: 'danger',
                title: '高驻波风险',
                message: results.standingWave.riskDescription
            });
            suggestions.push({
                title: '建议安装低音陷阱',
                content: '在房间四个墙角安装低音陷阱，特别是在125-200Hz频率范围有问题的模式。建议使用至少30cm深度的吸音材料。'
            });
        } else if (results.standingWave.riskLevel === 'medium') {
            warnings.push({
                type: 'warning',
                title: '中等驻波风险',
                message: results.standingWave.riskDescription
            });
            suggestions.push({
                title: '考虑低频处理',
                content: '建议在墙角或前后墙安装低音陷阱，以控制潜在的驻波问题。'
            });
        }
    }

    const target = getTargetRT60(results.volume);
    FREQUENCIES.forEach(freq => {
        const rt60Before = results.rt60.before[freq];
        const rt60After = results.rt60.after[freq];
        const targetValue = target[freq];

        if (freq <= 250 && rt60Before > targetValue * 1.5) {
            warnings.push({
                type: 'danger',
                title: `低频过量 (${freq}Hz)`,
                message: `当前混响时间 ${rt60Before.toFixed(2)}秒，超过目标值 ${targetValue.toFixed(2)}秒 过多，建议增加低频吸收材料。`
            });
            suggestions.push({
                title: `增加低频吸收 (${freq}Hz)`,
                content: '建议安装加厚的吸音材料（100mm以上）或使用共振器类型的低音陷阱。优先处理前后墙和墙角位置。'
            });
        }

        if (rt60After && rt60After > targetValue * 1.3) {
            warnings.push({
                type: 'warning',
                title: `改造后仍需优化 (${freq}Hz)`,
                message: `改造后混响时间 ${rt60After.toFixed(2)}秒，仍高于目标值 ${targetValue.toFixed(2)}秒。`
            });
        }
    });

    if (project.budgetLimit && results.budget.total > project.budgetLimit) {
        warnings.push({
            type: 'danger',
            title: '预算超限',
            message: `当前预算 ${results.budget.total.toFixed(0)}元，超过预算上限 ${project.budgetLimit.toFixed(0)}元，超出 ${(results.budget.total - project.budgetLimit).toFixed(0)}元。`
        });
        suggestions.push({
            title: '预算优化建议',
            content: '考虑减少高端材料使用面积，或选择更经济实惠的吸音材料。优先处理对声学效果影响最大的区域。'
        });
    }

    const surfaceTypes = [
        { key: 'wall', name: '墙面', minCoverage: 0.3 },
        { key: 'ceiling', name: '天花板', minCoverage: 0.4 }
    ];

    surfaceTypes.forEach(({ key, name, minCoverage }) => {
        const surface = project.surfaces[key];
        const area = parseFloat(surface.area) || 0;
        const coverage = parseFloat(surface.coverage) || 0;
        const ratio = area > 0 ? coverage / area : 0;

        if (area > 0 && ratio < minCoverage) {
            warnings.push({
                type: 'warning',
                title: `${name}材料覆盖不足`,
                message: `当前覆盖率 ${(ratio * 100).toFixed(0)}%，建议至少覆盖 ${(minCoverage * 100).toFixed(0)}% 以获得较好声学效果。`
            });
            suggestions.push({
                title: `增加${name}吸音材料覆盖`,
                content: `建议将${name}吸音材料覆盖率提高到至少${(minCoverage * 100).toFixed(0)}%，特别是在初次反射点和听音位置周围。`
            });
        }
    });

    if (warnings.length === 0) {
        warnings.push({
            type: 'success',
            title: '方案状态良好',
            message: '当前设计方案在主要声学指标和预算方面均符合要求。'
        });
    }

    return { warnings, suggestions };
}

function parsePulseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#') || line.startsWith(';')) continue;
        
        const values = line.split(/[,;\t]/);
        const timeValue = parseFloat(values[0]);
        const amplitudeValue = parseFloat(values[1]);
        
        if (!isNaN(timeValue) && !isNaN(amplitudeValue)) {
            data.push({
                time: timeValue,
                amplitude: amplitudeValue
            });
        }
    }
    
    return data;
}

function analyzePulseRT60(data) {
    if (data.length < 100) {
        return { error: '数据点不足，无法进行可靠分析' };
    }

    const dbValues = data.map(d => 20 * Math.log10(Math.abs(d.amplitude) + 0.000001));
    const maxDb = Math.max(...dbValues);
    
    let t0 = null;
    for (let i = 0; i < dbValues.length; i++) {
        if (dbValues[i] > maxDb - 10) {
            t0 = data[i].time;
            break;
        }
    }

    let t60 = null;
    for (let i = 0; i < dbValues.length; i++) {
        if (t0 !== null && dbValues[i] < maxDb - 60) {
            t60 = data[i].time - t0;
            break;
        }
    }

    const rt60Estimate = t60 || (t0 ? (data[data.length - 1].time - t0) * (60 / (maxDb - dbValues[dbValues.length - 1])) : null);

    return {
        sampleCount: data.length,
        duration: data[data.length - 1].time - data[0].time,
        maxAmplitude: maxDb,
        rt60Estimate: rt60Estimate,
        rawData: data
    };
}

function saveProjects() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

function loadProjects() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        projects = JSON.parse(saved);
    }
}

function saveCurrentProjectId() {
    if (currentProject && currentProject.id) {
        localStorage.setItem(CURRENT_PROJECT_KEY, currentProject.id);
    }
}

function loadCurrentProjectId() {
    return localStorage.getItem(CURRENT_PROJECT_KEY);
}

function createProject() {
    const id = 'project_' + Date.now();
    const project = JSON.parse(JSON.stringify(defaultProject));
    project.id = id;
    project.name = `方案 ${Object.keys(projects).length + 1}`;
    return project;
}

function updateProjectUI() {
    if (!currentProject) return;

    document.getElementById('roomLength').value = currentProject.room.length || '';
    document.getElementById('roomWidth').value = currentProject.room.width || '';
    document.getElementById('roomHeight').value = currentProject.room.height || '';

    ['wall', 'floor', 'ceiling'].forEach(type => {
        const surface = currentProject.surfaces[type];
        document.getElementById(`${type}Material`).value = surface.material || '';
        document.getElementById(`${type}Area`).value = surface.area || '';
        document.getElementById(`${type}Coverage`).value = surface.coverage || '';
        document.getElementById(`${type}NewMaterial`).value = surface.newMaterial || '';
    });

    document.getElementById('budgetLimit').value = currentProject.budgetLimit || '';
    document.getElementById('projectNotes').value = currentProject.notes || '';

    renderFurnitureList();
    updateProjectSelector();
    calculateAndDisplayVolume();
}

function populateMaterialSelectors() {
    const structuralMaterials = MATERIALS.filter(m => 
        ['structural', 'floor'].includes(m.category)
    );
    const treatmentMaterials = MATERIALS.filter(m => 
        m.category === 'treatment'
    );

    ['wall', 'floor', 'ceiling'].forEach(type => {
        const materialSelect = document.getElementById(`${type}Material`);
        const newMaterialSelect = document.getElementById(`${type}NewMaterial`);

        materialSelect.innerHTML = '<option value="">选择材料...</option>';
        newMaterialSelect.innerHTML = '<option value="">不改造</option>';

        MATERIALS.forEach(material => {
            const option = document.createElement('option');
            option.value = material.id;
            option.textContent = material.name;
            materialSelect.appendChild(option);
        });

        treatmentMaterials.forEach(material => {
            const option = document.createElement('option');
            option.value = material.id;
            option.textContent = `${material.name} (¥${material.price}/m²)`;
            newMaterialSelect.appendChild(option);
        });
    });
}

function updateProjectSelector() {
    const select = document.getElementById('projectSelect');
    select.innerHTML = '<option value="">选择方案...</option>';
    
    Object.values(projects).forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (currentProject && project.id === currentProject.id) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

function renderFurnitureList() {
    const container = document.getElementById('furnitureList');
    
    if (!currentProject || !currentProject.furniture || currentProject.furniture.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">暂无家具，点击下方按钮添加</p>';
        return;
    }

    container.innerHTML = '';
    
    currentProject.furniture.forEach((item, index) => {
        const type = getFurnitureTypeById(item.type);
        const div = document.createElement('div');
        div.className = 'furniture-item';
        div.innerHTML = `
            <div class="furniture-header">
                <select class="furniture-type-select" data-index="${index}">
                    ${FURNITURE_TYPES.map(t => `<option value="${t.id}" ${t.id === item.type ? 'selected' : ''}>${t.name}</option>`).join('')}
                </select>
                <button class="remove-furniture-btn" data-index="${index}">删除</button>
            </div>
            <div class="form-group">
                <label>吸音面积 (m²)</label>
                <input type="number" class="furniture-area" data-index="${index}" 
                       value="${item.area || (type ? type.defaultArea : '')}" 
                       min="0" step="0.1">
            </div>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.furniture-type-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            const typeId = e.target.value;
            currentProject.furniture[index].type = typeId;
            const type = getFurnitureTypeById(typeId);
            if (type) {
                currentProject.furniture[index].area = type.defaultArea;
            }
            saveCurrentProject();
            renderFurnitureList();
        });
    });

    container.querySelectorAll('.furniture-area').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            currentProject.furniture[index].area = parseFloat(e.target.value) || 0;
            saveCurrentProject();
        });
    });

    container.querySelectorAll('.remove-furniture-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            currentProject.furniture.splice(index, 1);
            saveCurrentProject();
            renderFurnitureList();
        });
    });
}

function saveCurrentProject() {
    if (!currentProject) return;

    currentProject.room.length = parseFloat(document.getElementById('roomLength').value) || '';
    currentProject.room.width = parseFloat(document.getElementById('roomWidth').value) || '';
    currentProject.room.height = parseFloat(document.getElementById('roomHeight').value) || '';

    ['wall', 'floor', 'ceiling'].forEach(type => {
        currentProject.surfaces[type].material = document.getElementById(`${type}Material`).value || '';
        currentProject.surfaces[type].area = parseFloat(document.getElementById(`${type}Area`).value) || '';
        currentProject.surfaces[type].coverage = parseFloat(document.getElementById(`${type}Coverage`).value) || '';
        currentProject.surfaces[type].newMaterial = document.getElementById(`${type}NewMaterial`).value || '';
    });

    currentProject.budgetLimit = parseFloat(document.getElementById('budgetLimit').value) || '';
    currentProject.notes = document.getElementById('projectNotes').value || '';
    currentProject.updatedAt = new Date().toISOString();

    projects[currentProject.id] = currentProject;
    saveProjects();
    saveCurrentProjectId();
}

function calculateAndDisplayVolume() {
    const length = parseFloat(document.getElementById('roomLength').value);
    const width = parseFloat(document.getElementById('roomWidth').value);
    const height = parseFloat(document.getElementById('roomHeight').value);

    const volumeDisplay = document.getElementById('roomVolume');

    if (isNaN(length) || isNaN(width) || isNaN(height)) {
        volumeDisplay.textContent = '房间体积: -- m³';
        return;
    }

    const volume = calculateRoomVolume(length, width, height);
    const surfaceAreas = calculateSurfaceArea(length, width, height);

    volumeDisplay.textContent = `房间体积: ${volume.toFixed(2)} m³`;

    document.getElementById('wallArea').value = document.getElementById('wallArea').value || surfaceAreas.wall.toFixed(2);
    document.getElementById('floorArea').value = document.getElementById('floorArea').value || surfaceAreas.floor.toFixed(2);
    document.getElementById('ceilingArea').value = document.getElementById('ceilingArea').value || surfaceAreas.ceiling.toFixed(2);

    saveCurrentProject();
}

function runCalculation() {
    saveCurrentProject();

    const length = parseFloat(currentProject.room.length);
    const width = parseFloat(currentProject.room.width);
    const height = parseFloat(currentProject.room.height);

    if (isNaN(length) || isNaN(width) || isNaN(height)) {
        alert('请输入完整的房间尺寸（长、宽、高）');
        return;
    }

    const volume = calculateRoomVolume(length, width, height);
    const waves = calculateStandingWaves(length, width, height);
    const standingWaveAnalysis = analyzeStandingWaveRisk(waves, volume);

    const absorptionBefore = calculateSurfaceAbsorption(
        currentProject.surfaces, 
        currentProject.furniture,
        false
    );
    const absorptionAfter = calculateSurfaceAbsorption(
        currentProject.surfaces, 
        currentProject.furniture,
        true
    );

    const rt60Results = {
        before: {},
        after: {}
    };

    FREQUENCIES.forEach(freq => {
        rt60Results.before[freq] = calculateRT60(
            volume, 
            { ...absorptionBefore, totalAbsorption: absorptionBefore.byFrequency[freq] },
            freq
        );
        rt60Results.after[freq] = calculateRT60(
            volume, 
            { ...absorptionAfter, totalAbsorption: absorptionAfter.byFrequency[freq] },
            freq
        );
    });

    const budget = calculateBudget(currentProject.surfaces);
    const target = getTargetRT60(volume);

    const results = {
        volume,
        standingWave: standingWaveAnalysis,
        rt60: rt60Results,
        absorption: {
            before: absorptionBefore,
            after: absorptionAfter
        },
        budget,
        target
    };

    const analysis = analyzeResults(currentProject, results);

    displayResults(results, analysis);
}

function displayResults(results, analysis) {
    displayStandingWaves(results.standingWave);
    displayRT60(results.rt60, results.target, results.volume);
    displayBudget(results.budget);
    displayCoverage();
    displayWarnings(analysis.warnings);
    displaySuggestions(analysis.suggestions);
}

function displayStandingWaves(analysis) {
    const container = document.getElementById('standingWaveResult');
    
    const lowFreqModes = analysis.lowFreqModes.filter(m => m.harmonic <= 3);
    const riskClass = {
        'low': 'risk-low',
        'medium': 'risk-medium',
        'high': 'risk-high'
    }[analysis.riskLevel];

    const riskText = {
        'low': '低风险',
        'medium': '中风险',
        'high': '高风险'
    }[analysis.riskLevel];

    let html = `
        <div class="standing-wave-result">
            <div class="wave-item">
                <div class="axis">整体风险</div>
                <div class="frequency">-</div>
                <span class="risk ${riskClass}">${riskText}</span>
            </div>
    `;

    const displayed = new Set();
    lowFreqModes.slice(0, 6).forEach(mode => {
        const key = `${mode.axis}_${mode.harmonic}`;
        if (displayed.has(key)) return;
        displayed.add(key);
        
        html += `
            <div class="wave-item">
                <div class="axis">${mode.axis} (${mode.harmonic}倍频)</div>
                <div class="frequency">${mode.frequency.toFixed(1)} Hz</div>
            </div>
        `;
    });

    html += `</div>`;
    html += `<p style="margin-top: 12px; font-size: 13px; color: #666;">${analysis.riskDescription}</p>`;
    
    if (analysis.clashes.length > 0) {
        html += `<p style="margin-top: 8px; font-size: 13px; color: #dc3545;">检测到 ${analysis.clashes.length} 个频率冲突，可能加剧驻波问题</p>`;
    }

    container.innerHTML = html;
}

function displayRT60(rt60, target, volume) {
    const tbody = document.getElementById('rt60TableBody');
    tbody.innerHTML = '';

    FREQUENCIES.forEach(freq => {
        const before = rt60.before[freq];
        const after = rt60.after[freq];
        const targetValue = target[freq];

        let status = 'good';
        let statusText = '正常';

        if (before > targetValue * 1.5) {
            status = 'danger';
            statusText = '过高';
        } else if (before > targetValue * 1.2) {
            status = 'warning';
            statusText = '偏高';
        } else if (before < targetValue * 0.5) {
            status = 'warning';
            statusText = '偏低';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${freq} Hz</td>
            <td>${before !== null ? before.toFixed(2) : '-'}</td>
            <td>${after !== null ? after.toFixed(2) : '-'}</td>
            <td>${targetValue.toFixed(2)}</td>
            <td class="status-${status}">${statusText}</td>
        `;
        tbody.appendChild(tr);
    });
}

function displayBudget(budget) {
    const container = document.getElementById('budgetResult');
    const budgetLimit = parseFloat(currentProject.budgetLimit) || Infinity;
    const isOverBudget = budget.total > budgetLimit;

    let html = `
        <div class="budget-detail">
            <div class="budget-item">
                <div class="label">总预算</div>
                <div class="value ${isOverBudget ? 'over-budget' : 'under-budget'}">
                    ¥${budget.total.toFixed(0)}
                </div>
            </div>
    `;

    if (budgetLimit > 0) {
        const remaining = budgetLimit - budget.total;
        html += `
            <div class="budget-item">
                <div class="label">预算上限</div>
                <div class="value">¥${budgetLimit.toFixed(0)}</div>
            </div>
            <div class="budget-item">
                <div class="label">${remaining >= 0 ? '剩余预算' : '超出预算'}</div>
                <div class="value ${remaining >= 0 ? 'under-budget' : 'over-budget'}">
                    ${remaining >= 0 ? '+' : ''}¥${remaining.toFixed(0)}
                </div>
            </div>
        `;
    }

    html += `</div>`;

    if (budget.items.length > 0) {
        html += `
            <div style="margin-top: 16px;">
                <h4 style="margin-bottom: 8px;">明细：</h4>
                <table style="width: 100%; font-size: 13px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 8px; text-align: left;">部位</th>
                            <th style="padding: 8px; text-align: left;">材料</th>
                            <th style="padding: 8px; text-align: right;">面积</th>
                            <th style="padding: 8px; text-align: right;">单价</th>
                            <th style="padding: 8px; text-align: right;">小计</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        budget.items.forEach(item => {
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 8px;">${item.surface}</td>
                    <td style="padding: 8px;">${item.material}</td>
                    <td style="padding: 8px; text-align: right;">${item.area.toFixed(1)} m²</td>
                    <td style="padding: 8px; text-align: right;">¥${item.unitPrice}</td>
                    <td style="padding: 8px; text-align: right;">¥${item.cost.toFixed(0)}</td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;
    }

    container.innerHTML = html;
}

function displayCoverage() {
    const container = document.getElementById('coverageResult');

    const surfaceTypes = [
        { key: 'wall', name: '墙面', area: currentProject.surfaces.wall.area, coverage: currentProject.surfaces.wall.coverage },
        { key: 'floor', name: '地面', area: currentProject.surfaces.floor.area, coverage: currentProject.surfaces.floor.coverage },
        { key: 'ceiling', name: '天花板', area: currentProject.surfaces.ceiling.area, coverage: currentProject.surfaces.ceiling.coverage }
    ];

    let html = '<div class="coverage-chart">';

    surfaceTypes.forEach(({ key, name, area, coverage }) => {
        const areaNum = parseFloat(area) || 0;
        const coverageNum = parseFloat(coverage) || 0;
        const percentage = areaNum > 0 ? (coverageNum / areaNum) * 100 : 0;

        let statusClass = 'good';
        if (key === 'wall' && percentage < 30) statusClass = 'warning';
        if (key === 'ceiling' && percentage < 40) statusClass = 'danger';
        if (percentage >= 80) statusClass = 'good';

        html += `
            <div class="coverage-item">
                <div class="coverage-label">
                    <span>${name} (${coverageNum.toFixed(1)} / ${areaNum.toFixed(1)} m²)</span>
                    <span>${percentage.toFixed(0)}%</span>
                </div>
                <div class="coverage-bar">
                    <div class="coverage-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%;"></div>
                </div>
            </div>
        `;
    });

    html += '</div>';

    const totalArea = surfaceTypes.reduce((sum, s) => sum + (parseFloat(s.area) || 0), 0);
    const totalCoverage = surfaceTypes.reduce((sum, s) => sum + (parseFloat(s.coverage) || 0), 0);
    const totalPercentage = totalArea > 0 ? (totalCoverage / totalArea) * 100 : 0;

    html += `
        <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 8px;">
            <strong>总覆盖率：</strong>${totalPercentage.toFixed(1)}% 
            (${totalCoverage.toFixed(1)} / ${totalArea.toFixed(1)} m²)
        </div>
    `;

    container.innerHTML = html;
}

function displayWarnings(warnings) {
    const container = document.getElementById('warningsList');
    container.innerHTML = '';

    warnings.forEach(warning => {
        const div = document.createElement('div');
        div.className = `warning-item ${warning.type}`;
        div.innerHTML = `
            <strong>${warning.title}</strong><br>
            ${warning.message}
        `;
        container.appendChild(div);
    });
}

function displaySuggestions(suggestions) {
    const container = document.getElementById('suggestionsContent');
    
    if (suggestions.length === 0) {
        container.innerHTML = '<p>当前方案设计合理，暂无特别建议。</p>';
        return;
    }

    container.innerHTML = '';
    suggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.className = 'suggestion-item';
        div.innerHTML = `
            <h4>${suggestion.title}</h4>
            <p>${suggestion.content}</p>
        `;
        container.appendChild(div);
    });
}

function exportMarkdown() {
    saveCurrentProject();
    
    const length = parseFloat(currentProject.room.length);
    const width = parseFloat(currentProject.room.width);
    const height = parseFloat(currentProject.room.height);

    if (isNaN(length) || isNaN(width) || isNaN(height)) {
        alert('请先完成房间参数输入并计算');
        return;
    }

    const volume = calculateRoomVolume(length, width, height);
    const waves = calculateStandingWaves(length, width, height);
    const standingWaveAnalysis = analyzeStandingWaveRisk(waves, volume);
    const absorptionBefore = calculateSurfaceAbsorption(currentProject.surfaces, currentProject.furniture, false);
    const absorptionAfter = calculateSurfaceAbsorption(currentProject.surfaces, currentProject.furniture, true);
    const target = getTargetRT60(volume);
    const budget = calculateBudget(currentProject.surfaces);

    let md = `# ${currentProject.name} - 录音棚混响改造方案\n\n`;
    md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

    md += `## 1. 房间基本信息\n\n`;
    md += `- 房间尺寸: ${length}m × ${width}m × ${height}m\n`;
    md += `- 房间体积: ${volume.toFixed(2)} m³\n`;
    md += `- 表面积: ${(2 * (length * width + length * height + width * height)).toFixed(2)} m²\n\n`;

    md += `## 2. 表面材料配置\n\n`;
    md += `| 部位 | 现有材料 | 改造材料 | 覆盖面积 | 覆盖率 |\n`;
    md += `|------|----------|----------|----------|--------|\n`;

    ['wall', 'floor', 'ceiling'].forEach(type => {
        const names = { wall: '墙面', floor: '地面', ceiling: '天花板' };
        const surface = currentProject.surfaces[type];
        const area = parseFloat(surface.area) || 0;
        const coverage = parseFloat(surface.coverage) || 0;
        const oldMat = getMaterialById(surface.material);
        const newMat = getMaterialById(surface.newMaterial);
        const ratio = area > 0 ? (coverage / area) * 100 : 0;

        md += `| ${names[type]} | ${oldMat ? oldMat.name : '-'} | ${newMat ? newMat.name : '无'} | ${coverage.toFixed(1)} m² | ${ratio.toFixed(0)}% |\n`;
    });
    md += '\n';

    if (currentProject.furniture.length > 0) {
        md += `## 3. 家具/物品\n\n`;
        md += `| 物品类型 | 吸音面积 |\n`;
        md += `|----------|----------|\n`;
        currentProject.furniture.forEach(item => {
            const type = getFurnitureTypeById(item.type);
            md += `| ${type ? type.name : item.type} | ${item.area} m² |\n`;
        });
        md += '\n';
    }

    md += `## 4. 驻波分析\n\n`;
    const riskText = { 'low': '低风险', 'medium': '中等风险', 'high': '高风险' };
    md += `**风险等级**: ${riskText[standingWaveAnalysis.riskLevel]}\n\n`;
    md += `${standingWaveAnalysis.riskDescription}\n\n`;

    md += `### 主要低频模式 (前3倍频)\n\n`;
    md += `| 轴 | 倍频 | 频率 |\n`;
    md += `|----|------|------|\n`;
    const displayed = new Set();
    standingWaveAnalysis.lowFreqModes.filter(m => m.harmonic <= 3).slice(0, 9).forEach(mode => {
        const key = `${mode.axis}_${mode.harmonic}`;
        if (displayed.has(key)) return;
        displayed.add(key);
        md += `| ${mode.axis} | ${mode.harmonic} | ${mode.frequency.toFixed(1)} Hz |\n`;
    });
    md += '\n';

    md += `## 5. RT60 混响时间分析\n\n`;
    md += `| 频率 | 改造前 | 改造后 | 目标值 | 状态 |\n`;
    md += `|------|--------|--------|--------|------|\n`;

    FREQUENCIES.forEach(freq => {
        const before = calculateRT60(volume, { ...absorptionBefore, totalAbsorption: absorptionBefore.byFrequency[freq] }, freq);
        const after = calculateRT60(volume, { ...absorptionAfter, totalAbsorption: absorptionAfter.byFrequency[freq] }, freq);
        const targetValue = target[freq];
        
        let status = '正常';
        if (before > targetValue * 1.5) status = '过高';
        else if (before > targetValue * 1.2) status = '偏高';
        else if (before < targetValue * 0.5) status = '偏低';

        md += `| ${freq} Hz | ${before ? before.toFixed(2) : '-'} | ${after ? after.toFixed(2) : '-'} | ${targetValue.toFixed(2)} | ${status} |\n`;
    });
    md += '\n';

    md += `## 6. 预算明细\n\n`;
    md += `**总预算**: ¥${budget.total.toFixed(0)}\n`;
    if (currentProject.budgetLimit) {
        const remaining = currentProject.budgetLimit - budget.total;
        md += `**预算上限**: ¥${currentProject.budgetLimit.toFixed(0)}\n`;
        md += `**${remaining >= 0 ? '剩余' : '超出'}**: ¥${Math.abs(remaining).toFixed(0)}\n`;
    }
    md += '\n';

    if (budget.items.length > 0) {
        md += `### 材料明细\n\n`;
        md += `| 部位 | 材料 | 面积 | 单价 | 小计 |\n`;
        md += `|------|------|------|------|------|\n`;
        budget.items.forEach(item => {
            md += `| ${item.surface} | ${item.material} | ${item.area.toFixed(1)} m² | ¥${item.unitPrice} | ¥${item.cost.toFixed(0)} |\n`;
        });
        md += '\n';
    }

    if (currentProject.notes) {
        md += `## 7. 备注\n\n`;
        md += `${currentProject.notes}\n\n`;
    }

    md += `\n---\n\n*此方案由录音棚混响改造测算工具生成*`;

    downloadFile(md, `${currentProject.name}_施工方案.md`, 'text/markdown');
}

function exportJSON() {
    saveCurrentProject();

    const exportData = {
        project: {
            name: currentProject.name,
            createdAt: currentProject.createdAt,
            updatedAt: currentProject.updatedAt,
            room: currentProject.room,
            surfaces: currentProject.surfaces,
            furniture: currentProject.furniture,
            budgetLimit: currentProject.budgetLimit,
            notes: currentProject.notes
        },
        calculations: null
    };

    const length = parseFloat(currentProject.room.length);
    const width = parseFloat(currentProject.room.width);
    const height = parseFloat(currentProject.room.height);

    if (!isNaN(length) && !isNaN(width) && !isNaN(height)) {
        const volume = calculateRoomVolume(length, width, height);
        const waves = calculateStandingWaves(length, width, height);
        const standingWaveAnalysis = analyzeStandingWaveRisk(waves, volume);
        const absorptionBefore = calculateSurfaceAbsorption(currentProject.surfaces, currentProject.furniture, false);
        const absorptionAfter = calculateSurfaceAbsorption(currentProject.surfaces, currentProject.furniture, true);
        const target = getTargetRT60(volume);
        const budget = calculateBudget(currentProject.surfaces);

        const rt60 = { before: {}, after: {} };
        FREQUENCIES.forEach(freq => {
            rt60.before[freq] = calculateRT60(volume, { ...absorptionBefore, totalAbsorption: absorptionBefore.byFrequency[freq] }, freq);
            rt60.after[freq] = calculateRT60(volume, { ...absorptionAfter, totalAbsorption: absorptionAfter.byFrequency[freq] }, freq);
        });

        exportData.calculations = {
            volume,
            surfaceArea: calculateSurfaceArea(length, width, height),
            standingWaves: standingWaveAnalysis,
            rt60,
            targetRT60: target,
            absorption: {
                before: absorptionBefore,
                after: absorptionAfter
            },
            budget
        };
    }

    const jsonStr = JSON.stringify(exportData, null, 2);
    downloadFile(jsonStr, `${currentProject.name}_明细.json`, 'application/json');
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function init() {
    loadProjects();
    populateMaterialSelectors();

    const savedProjectId = loadCurrentProjectId();
    if (savedProjectId && projects[savedProjectId]) {
        currentProject = projects[savedProjectId];
    } else if (Object.keys(projects).length > 0) {
        currentProject = Object.values(projects)[0];
    } else {
        currentProject = createProject();
        projects[currentProject.id] = currentProject;
        saveProjects();
    }

    updateProjectUI();

    ['roomLength', 'roomWidth', 'roomHeight'].forEach(id => {
        document.getElementById(id).addEventListener('input', () => {
            calculateAndDisplayVolume();
            saveCurrentProject();
        });
    });

    ['wall', 'floor', 'ceiling'].forEach(type => {
        [`${type}Material`, `${type}Area`, `${type}Coverage`, `${type}NewMaterial`].forEach(id => {
            document.getElementById(id).addEventListener('change', saveCurrentProject);
            document.getElementById(id).addEventListener('input', saveCurrentProject);
        });
    });

    document.getElementById('budgetLimit').addEventListener('input', saveCurrentProject);
    document.getElementById('projectNotes').addEventListener('input', saveCurrentProject);

    document.getElementById('projectSelect').addEventListener('change', (e) => {
        const projectId = e.target.value;
        if (projectId && projects[projectId]) {
            currentProject = projects[projectId];
            saveCurrentProjectId();
            updateProjectUI();
        }
    });

    document.getElementById('newProjectBtn').addEventListener('click', () => {
        const newProject = createProject();
        projects[newProject.id] = newProject;
        currentProject = newProject;
        saveProjects();
        saveCurrentProjectId();
        updateProjectUI();
    });

    document.getElementById('renameProjectBtn').addEventListener('click', () => {
        if (!currentProject) return;
        const newName = prompt('输入新方案名称:', currentProject.name);
        if (newName && newName.trim()) {
            currentProject.name = newName.trim();
            saveCurrentProject();
            updateProjectSelector();
        }
    });

    document.getElementById('deleteProjectBtn').addEventListener('click', () => {
        if (!currentProject) return;
        if (Object.keys(projects).length <= 1) {
            alert('至少需要保留一个方案');
            return;
        }
        if (confirm(`确定删除方案 "${currentProject.name}" 吗？`)) {
            delete projects[currentProject.id];
            const remainingIds = Object.keys(projects);
            currentProject = projects[remainingIds[0]];
            saveProjects();
            saveCurrentProjectId();
            updateProjectUI();
        }
    });

    document.getElementById('addFurnitureBtn').addEventListener('click', () => {
        if (!currentProject) return;
        currentProject.furniture.push({
            type: 'sofa',
            area: 2.0
        });
        saveCurrentProject();
        renderFurnitureList();
    });

    document.getElementById('calculateBtn').addEventListener('click', runCalculation);

    document.getElementById('exportMarkdownBtn').addEventListener('click', exportMarkdown);

    document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);

    document.getElementById('pulseFile').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csvText = event.target.result;
            const data = parsePulseCSV(csvText);
            
            if (data.length === 0) {
                alert('无法解析CSV文件，请检查格式');
                return;
            }

            const analysis = analyzePulseRT60(data);
            
            let infoText = `文件: ${file.name}\n`;
            infoText += `数据点: ${analysis.sampleCount}\n`;
            infoText += `时长: ${analysis.duration.toFixed(3)} 秒\n`;
            
            if (analysis.rt60Estimate) {
                infoText += `估算RT60: ${analysis.rt60Estimate.toFixed(3)} 秒`;
            } else {
                infoText += `无法准确计算RT60`;
            }

            document.getElementById('pulseInfo').textContent = infoText;
            pulseData = data;
            currentProject.pulseData = {
                filename: file.name,
                sampleCount: analysis.sampleCount,
                rt60Estimate: analysis.rt60Estimate
            };
            saveCurrentProject();
        };
        reader.readAsText(file);
    });
}

document.addEventListener('DOMContentLoaded', init);