import type { 
  PhysicsParams, 
  DataRecord, 
  CalculationResult, 
  CalculationStep, 
  UnitConversion 
} from '@/types';
import { UnitConverter } from './unitConverter';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

const PHYSICAL_CONSTANTS = {
  ICE_DENSITY: 917,
  ICE_SPECIFIC_HEAT: 2100,
  WATER_LATENT_HEAT: 334000,
  CONVECTIVE_HEAT_TRANSFER: 8.7,
  STEFAN_BOLTZMANN: 5.67e-8,
  EMISSIVITY_ICE: 0.95,
  AIR_DENSITY: 1.2,
  AIR_SPECIFIC_HEAT: 1005,
  LATENT_HEAT_VAPORIZATION: 2501000,
  PERSON_HEAT_DISSIpATION: 100,
  EQUIPMENT_EFFICIENCY: 0.9,
  LIGHTING_EFFICIENCY: 0.7,
} as const;

export class CoolingLoadCalculator {
  private params: PhysicsParams;
  private unitConversions: UnitConversion[] = [];

  constructor(params: PhysicsParams) {
    this.params = { ...params };
  }

  private normalizeParams(): {
    iceArea_m2: number;
    iceThickness_m: number;
    iceTemp_K: number;
    ambientTemp_K: number;
    equipmentPower_kW: number;
    lightingPower_kW: number;
  } {
    const iceArea_m2 = UnitConverter.convertArea(
      this.params.iceArea,
      this.params.iceAreaUnit,
      'm²'
    );
    if (this.params.iceAreaUnit !== 'm²') {
      this.unitConversions.push(UnitConverter.createConversion(
        this.params.iceAreaUnit, 'm²', this.params.iceArea, iceArea_m2
      ));
    }

    const iceThickness_m = UnitConverter.convertThickness(
      this.params.iceThickness,
      this.params.iceThicknessUnit,
      'mm'
    ) / 1000;
    if (this.params.iceThicknessUnit !== 'mm') {
      this.unitConversions.push(UnitConverter.createConversion(
        this.params.iceThicknessUnit, 'mm', this.params.iceThickness, iceThickness_m * 1000
      ));
    }

    const iceTemp_K = UnitConverter.convertTemperature(
      this.params.iceTemperature,
      this.params.iceTemperatureUnit,
      'K'
    );
    if (this.params.iceTemperatureUnit !== 'K') {
      this.unitConversions.push(UnitConverter.createConversion(
        this.params.iceTemperatureUnit, 'K', this.params.iceTemperature, iceTemp_K
      ));
    }

    const equipmentPower_kW = UnitConverter.convertPower(
      this.params.equipmentPower,
      this.params.equipmentPowerUnit,
      'kW'
    );
    if (this.params.equipmentPowerUnit !== 'kW') {
      this.unitConversions.push(UnitConverter.createConversion(
        this.params.equipmentPowerUnit, 'kW', this.params.equipmentPower, equipmentPower_kW
      ));
    }

    const lightingPower_kW = UnitConverter.convertPower(
      this.params.lightingPower,
      this.params.lightingPowerUnit,
      'kW'
    );
    if (this.params.lightingPowerUnit !== 'kW') {
      this.unitConversions.push(UnitConverter.createConversion(
        this.params.lightingPowerUnit, 'kW', this.params.lightingPower, lightingPower_kW
      ));
    }

    return {
      iceArea_m2,
      iceThickness_m,
      iceTemp_K,
      ambientTemp_K: 0,
      equipmentPower_kW,
      lightingPower_kW,
    };
  }

  calculateIceLoad(): CalculationStep {
    const { iceArea_m2, iceThickness_m, iceTemp_K } = this.normalizeParams();
    const { ICE_DENSITY, ICE_SPECIFIC_HEAT, CONVECTIVE_HEAT_TRANSFER } = PHYSICAL_CONSTANTS;

    const deltaT = 273.15 - iceTemp_K;
    const iceMaintenanceCoeff = 1.5;
    const result = iceMaintenanceCoeff * iceArea_m2 * deltaT / 1000;

    return {
      id: generateId(),
      name: '冰层蓄冷负荷',
      formula: 'Q_ice = k × A × ΔT (稳态近似)',
      inputs: {
        'k': iceMaintenanceCoeff,
        'A': iceArea_m2,
        'ΔT': deltaT,
      },
      result,
      unit: 'kW',
    };
  }

  calculateConvectionLoad(ambientTemp: number, ambientTempUnit: string): CalculationStep {
    const { iceArea_m2, iceTemp_K } = this.normalizeParams();
    const { CONVECTIVE_HEAT_TRANSFER } = PHYSICAL_CONSTANTS;

    const ambientTemp_C = UnitConverter.convertTemperature(ambientTemp, ambientTempUnit as any, '°C');
    const iceTemp_C = UnitConverter.convertTemperature(iceTemp_K, 'K', '°C');
    const deltaT = ambientTemp_C - iceTemp_C;
    const result = CONVECTIVE_HEAT_TRANSFER * iceArea_m2 * deltaT / 1000;

    return {
      id: generateId(),
      name: '对流换热负荷',
      formula: 'Q_conv = h × A × ΔT',
      inputs: {
        'h': CONVECTIVE_HEAT_TRANSFER,
        'A': iceArea_m2,
        'ΔT': deltaT,
      },
      result,
      unit: 'kW',
    };
  }

  calculateRadiationLoad(ambientTemp: number, ambientTempUnit: string): CalculationStep {
    const { iceArea_m2, iceTemp_K } = this.normalizeParams();
    const { STEFAN_BOLTZMANN, EMISSIVITY_ICE } = PHYSICAL_CONSTANTS;

    const ambientTemp_K = UnitConverter.convertTemperature(ambientTemp, ambientTempUnit as any, 'K');
    const result = STEFAN_BOLTZMANN * EMISSIVITY_ICE * iceArea_m2 * 
                   (Math.pow(ambientTemp_K, 4) - Math.pow(iceTemp_K, 4)) / 1000;

    return {
      id: generateId(),
      name: '辐射换热负荷',
      formula: 'Q_rad = σ × ε × A × (T_amb⁴ - T_ice⁴)',
      inputs: {
        'σ': STEFAN_BOLTZMANN,
        'ε': EMISSIVITY_ICE,
        'A': iceArea_m2,
        'T_amb⁴': Math.pow(ambientTemp_K, 4),
        'T_ice⁴': Math.pow(iceTemp_K, 4),
      },
      result,
      unit: 'kW',
    };
  }

  calculateMoistureLoad(humidity: number, ambientTemp: number, ambientTempUnit: string): CalculationStep {
    const { iceArea_m2, iceTemp_K } = this.normalizeParams();
    const { AIR_DENSITY, LATENT_HEAT_VAPORIZATION } = PHYSICAL_CONSTANTS;

    const ambientTemp_C = UnitConverter.convertTemperature(ambientTemp, ambientTempUnit as any, '°C');
    const iceTemp_C = UnitConverter.convertTemperature(iceTemp_K, 'K', '°C');
    
    const saturationPressureAmbient = 0.6108 * Math.exp(17.27 * ambientTemp_C / (ambientTemp_C + 237.3));
    const saturationPressureIce = 0.6108 * Math.exp(21.875 * iceTemp_C / (iceTemp_C + 265.5));
    
    const vaporPressureAmbient = saturationPressureAmbient * (humidity / 100);
    const pressureDiff = Math.max(0, vaporPressureAmbient - saturationPressureIce);
    
    const moistureTransfer = 0.017 * pressureDiff * iceArea_m2;
    const result = moistureTransfer * LATENT_HEAT_VAPORIZATION / 3600000;

    return {
      id: generateId(),
      name: '湿负荷（潜热）',
      formula: 'Q_moist = m_water × h_latent',
      inputs: {
        'm_water': moistureTransfer,
        'h_latent': LATENT_HEAT_VAPORIZATION,
        'P_amb_sat': saturationPressureAmbient,
        'P_ice_sat': saturationPressureIce,
        'RH': humidity / 100,
      },
      result,
      unit: 'kW',
    };
  }

  calculatePersonnelLoad(): CalculationStep {
    const { PERSON_HEAT_DISSIpATION } = PHYSICAL_CONSTANTS;
    const result = this.params.peopleCount * PERSON_HEAT_DISSIpATION / 1000;

    return {
      id: generateId(),
      name: '人员散热负荷',
      formula: 'Q_people = n × q_person',
      inputs: {
        'n': this.params.peopleCount,
        'q_person': PERSON_HEAT_DISSIpATION,
      },
      result,
      unit: 'kW',
    };
  }

  calculateEquipmentLoad(): CalculationStep {
    const { equipmentPower_kW } = this.normalizeParams();
    const { EQUIPMENT_EFFICIENCY } = PHYSICAL_CONSTANTS;
    const result = equipmentPower_kW * (1 - EQUIPMENT_EFFICIENCY);

    return {
      id: generateId(),
      name: '设备散热负荷',
      formula: 'Q_equipment = P_equipment × (1 - η)',
      inputs: {
        'P_equipment': equipmentPower_kW,
        'η': EQUIPMENT_EFFICIENCY,
      },
      result,
      unit: 'kW',
    };
  }

  calculateLightingLoad(): CalculationStep {
    const { lightingPower_kW } = this.normalizeParams();
    const { LIGHTING_EFFICIENCY } = PHYSICAL_CONSTANTS;
    const result = lightingPower_kW * (1 - LIGHTING_EFFICIENCY);

    return {
      id: generateId(),
      name: '照明散热负荷',
      formula: 'Q_lighting = P_lighting × (1 - η)',
      inputs: {
        'P_lighting': lightingPower_kW,
        'η': LIGHTING_EFFICIENCY,
      },
      result,
      unit: 'kW',
    };
  }

  calculateTotal(record: DataRecord): CalculationResult {
    this.unitConversions = [];
    
    const iceStep = this.calculateIceLoad();
    const convStep = this.calculateConvectionLoad(record.temperature, record.temperatureUnit);
    const radStep = this.calculateRadiationLoad(record.temperature, record.temperatureUnit);
    const moistStep = this.calculateMoistureLoad(record.humidity, record.temperature, record.temperatureUnit);
    const peopleStep = this.calculatePersonnelLoad();
    const equipStep = this.calculateEquipmentLoad();
    const lightStep = this.calculateLightingLoad();

    if (record.temperatureUnit !== '°C') {
      const tempC = UnitConverter.convertTemperature(record.temperature, record.temperatureUnit, '°C');
      this.unitConversions.push(UnitConverter.createConversion(
        record.temperatureUnit, '°C', record.temperature, tempC
      ));
    }

    const totalLoad = iceStep.result + convStep.result + radStep.result + 
                      moistStep.result + peopleStep.result + equipStep.result + lightStep.result;

    if (record.coolingLoadUnit && record.coolingLoadUnit !== 'kW') {
      const convertedValue = UnitConverter.convertPower(totalLoad, 'kW', record.coolingLoadUnit);
      this.unitConversions.push(UnitConverter.createConversion(
        'kW', record.coolingLoadUnit, totalLoad, convertedValue
      ));
    }

    return {
      id: generateId(),
      recordId: record.id,
      totalLoad,
      totalLoadUnit: 'kW',
      iceLoad: iceStep.result,
      convectionLoad: convStep.result,
      radiationLoad: radStep.result,
      moistureLoad: moistStep.result,
      personnelLoad: peopleStep.result,
      equipmentLoad: equipStep.result,
      lightingLoad: lightStep.result,
      calculationSteps: [iceStep, convStep, radStep, moistStep, peopleStep, equipStep, lightStep],
      unitConversions: [...this.unitConversions],
    };
  }
}
