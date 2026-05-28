import { SpaceStation } from '../models/SpaceStation.js'
import { Module } from '../models/Module.js'
import { SolarPanel } from '../models/SolarPanel.js'
import { Battery } from '../models/Battery.js'
import { Load, LoadPriority, LoadCategory } from '../models/Load.js'

export class ScenarioData {
  static createBasicStation() {
    const station = new SpaceStation('station-001', '曙光号空间站')
    
    const coreModule = new Module('core-001', '核心舱', 'core', { x: 0, y: 0 })
    coreModule.addSolarPanel(new SolarPanel('sp-core-01', '主太阳能阵列-A', 80, 0.95, 45))
    coreModule.addSolarPanel(new SolarPanel('sp-core-02', '主太阳能阵列-B', 80, 0.95, 45))
    coreModule.addBattery(new Battery('bat-core-01', '主电池组-A', 200, 50, 50))
    coreModule.addBattery(new Battery('bat-core-02', '主电池组-B', 200, 50, 50))
    coreModule.addLoad(new Load('load-life-01', '生命维持系统', LoadCategory.LIFE_SUPPORT, LoadPriority.CRITICAL, 45, 'core-001'))
    coreModule.addLoad(new Load('load-comm-01', '主通信系统', LoadCategory.COMMUNICATION, LoadPriority.HIGH, 15, 'core-001'))
    coreModule.addLoad(new Load('load-comp-01', '主计算机', LoadCategory.SCIENCE, LoadPriority.HIGH, 20, 'core-001'))
    station.addModule(coreModule)
    
    const labModule = new Module('lab-001', '实验舱', 'laboratory', { x: 1, y: 0 })
    labModule.addSolarPanel(new SolarPanel('sp-lab-01', '实验舱太阳能板', 60, 0.9, 60))
    labModule.addBattery(new Battery('bat-lab-01', '实验舱备用电池', 100, 30, 30))
    labModule.addLoad(new Load('load-sci-01', '材料科学实验', LoadCategory.SCIENCE, LoadPriority.MEDIUM, 25, 'lab-001'))
    labModule.addLoad(new Load('load-sci-02', '生物培养箱', LoadCategory.SCIENCE, LoadPriority.MEDIUM, 15, 'lab-001'))
    labModule.addLoad(new Load('load-sci-03', '数据分析仪', LoadCategory.SCIENCE, LoadPriority.LOW, 10, 'lab-001'))
    station.addModule(labModule)
    
    const habModule = new Module('hab-001', '居住舱', 'habitat', { x: -1, y: 0 })
    habModule.addBattery(new Battery('bat-hab-01', '居住舱应急电池', 80, 20, 20))
    habModule.addLoad(new Load('load-light-01', '照明系统', LoadCategory.COMFORT, LoadPriority.MEDIUM, 10, 'hab-001'))
    habModule.addLoad(new Load('load-food-01', '食物储备系统', LoadCategory.COMFORT, LoadPriority.HIGH, 8, 'hab-001'))
    habModule.addLoad(new Load('load-vent-01', '通风系统', LoadCategory.COMFORT, LoadPriority.MEDIUM, 5, 'hab-001'))
    habModule.addLoad(new Load('load-therm-01', '温控系统', LoadCategory.COMFORT, LoadPriority.MEDIUM, 12, 'hab-001'))
    station.addModule(habModule)
    
    return station
  }

  static createLowBatteryScenario() {
    const station = this.createBasicStation()
    station.name = '曙光号 - 低电量危机'
    
    const batteries = station.getAllBatteries()
    batteries.forEach(bat => {
      bat.currentCharge = bat.capacity * 0.12
      bat.overDischargeCount = 2
    })
    
    station.sunAngle = -10
    station.currentTurn = 8
    
    return station
  }

  static createMeteorDamageScenario() {
    const station = this.createBasicStation()
    station.name = '曙光号 - 陨石撞击后'
    
    const coreModule = station.getModule('core-001')
    const labModule = station.getModule('lab-001')
    
    coreModule.solarPanels[0].applyDamage(0.6)
    labModule.solarPanels[0].applyDamage(0.4)
    
    coreModule.batteries[1].applyDamage(0.3)
    
    coreModule.applyHullDamage(25)
    labModule.applyHullDamage(15)
    
    return station
  }

  static createEclipseScenario() {
    const station = this.createBasicStation()
    station.name = '曙光号 - 星食期'
    
    station.sunAngle = -45
    
    const batteries = station.getAllBatteries()
    batteries.forEach(bat => {
      bat.currentCharge = bat.capacity * 0.35
    })
    
    const extraLoad = new Load('load-prop-01', '轨道维持推进器', LoadCategory.PROPULSION, LoadPriority.HIGH, 35, 'core-001')
    station.getModule('core-001').addLoad(extraLoad)
    
    return station
  }

  static createOverloadedScenario() {
    const station = this.createBasicStation()
    station.name = '曙光号 - 过载测试'
    
    const coreModule = station.getModule('core-001')
    const labModule = station.getModule('lab-001')
    
    coreModule.addLoad(new Load('load-exp-01', '扩展实验设备A', LoadCategory.SCIENCE, LoadPriority.MEDIUM, 30, 'core-001'))
    labModule.addLoad(new Load('load-exp-02', '扩展实验设备B', LoadCategory.SCIENCE, LoadPriority.MEDIUM, 25, 'lab-001'))
    labModule.addLoad(new Load('load-exp-03', '扩展实验设备C', LoadCategory.SCIENCE, LoadPriority.LOW, 20, 'lab-001'))
    
    return station
  }

  static createThermalRunawayScenario() {
    const station = this.createBasicStation()
    station.name = '曙光号 - 热失控边缘'
    
    const batteries = station.getAllBatteries()
    batteries.forEach(bat => {
      bat.temperature = 48
      bat.overChargeCount = 3
      bat.currentCharge = bat.capacity * 0.95
    })
    
    station.sunAngle = 110
    
    return station
  }

  static getScenarios() {
    return [
      {
        id: 'basic',
        name: '标准配置',
        description: '空间站正常运行状态，用于学习基础配平操作',
        difficulty: 'easy',
        create: () => this.createBasicStation()
      },
      {
        id: 'low_battery',
        name: '低电量危机',
        description: '电池过放预警，太阳角度不利，需要立即进行负载管理',
        difficulty: 'hard',
        features: ['电池过放', '太阳角度差', '需要切负载'],
        create: () => this.createLowBatteryScenario()
      },
      {
        id: 'meteor',
        name: '陨石撞击',
        description: '太阳能板受损，电池损坏，需要在设备降级情况下维持运行',
        difficulty: 'hard',
        features: ['设备损坏', '发电能力下降', '冗余设计考验'],
        create: () => this.createMeteorDamageScenario()
      },
      {
        id: 'eclipse',
        name: '星食期',
        description: '长时间无日照，完全依赖电池供电，必须精确计算能耗',
        difficulty: 'medium',
        features: ['零太阳能', '纯电池放电', '额外推进负载'],
        create: () => this.createEclipseScenario()
      },
      {
        id: 'overload',
        name: '过载测试',
        description: '实验任务高峰期，负载远超设计容量，优先级决策至关重要',
        difficulty: 'medium',
        features: ['负载过载', '多设备竞争', '优先级权衡'],
        create: () => this.createOverloadedScenario()
      },
      {
        id: 'thermal',
        name: '热失控边缘',
        description: '电池过热，过充次数过多，需要控制充电速度并降温',
        difficulty: 'expert',
        features: ['电池过热', '过充保护', '精细管理'],
        create: () => this.createThermalRunawayScenario()
      }
    ]
  }
}
