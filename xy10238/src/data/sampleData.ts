import type { HouseType, ElectricityPrice, WeatherData, EnergyConsumption } from '../types';
import { createNormalizedHouseType } from '../utils/houseNormalization';

export const sampleHouseTypes: HouseType[] = [
  createNormalizedHouseType({
    name: '传统土坯房',
    area: 80,
    insulationLevel: 'poor',
    floorCount: 1,
    buildingAge: 35,
    location: '华北平原',
  }),
  createNormalizedHouseType({
    name: '砖瓦房中等保温',
    area: 120,
    insulationLevel: 'medium',
    floorCount: 1,
    buildingAge: 20,
    location: '华北平原',
  }),
  createNormalizedHouseType({
    name: '新建节能房',
    area: 100,
    insulationLevel: 'good',
    floorCount: 2,
    buildingAge: 5,
    location: '华北平原',
  }),
  createNormalizedHouseType({
    name: '农村别墅型',
    area: 200,
    insulationLevel: 'good',
    floorCount: 2,
    buildingAge: 3,
    location: '华北平原',
  }),
];

export const sampleElectricityPrices: ElectricityPrice[] = [
  {
    id: 'price-default',
    name: '居民阶梯电价',
    pricePerKWh: 0.56,
    tier: '第一阶梯',
    hasTimeOfUse: false,
    peakPrice: 0,
    offPeakPrice: 0,
    timeZone: 'Asia/Shanghai',
  },
  {
    id: 'price-time-of-use',
    name: '峰谷电价',
    pricePerKWh: 0.56,
    tier: '分时电价',
    hasTimeOfUse: true,
    peakPrice: 0.85,
    offPeakPrice: 0.35,
    timeZone: 'Asia/Shanghai',
  },
  {
    id: 'price-commercial',
    name: '商业用电',
    pricePerKWh: 0.88,
    tier: '商业',
    hasTimeOfUse: false,
    peakPrice: 0,
    offPeakPrice: 0,
    timeZone: 'Asia/Shanghai',
  },
  {
    id: 'price-low-carbon',
    name: '低碳优惠电价',
    pricePerKWh: 0.42,
    tier: '特殊优惠',
    hasTimeOfUse: false,
    peakPrice: 0,
    offPeakPrice: 0,
    timeZone: 'Asia/Shanghai',
  },
];

export const generateWeatherData = (houseId: string, year: number): WeatherData[] => {
  const monthlyData = [
    { month: 1, temp: -5, hdd: 690, solar: 100, wind: 3.5 },
    { month: 2, temp: -2, hdd: 560, solar: 150, wind: 3.2 },
    { month: 3, temp: 5, hdd: 390, solar: 250, wind: 3.0 },
    { month: 4, temp: 12, hdd: 180, solar: 350, wind: 2.8 },
    { month: 5, temp: 18, hdd: 0, solar: 450, wind: 2.5 },
    { month: 6, temp: 24, hdd: 0, solar: 500, wind: 2.0 },
    { month: 7, temp: 26, hdd: 0, solar: 480, wind: 1.8 },
    { month: 8, temp: 25, hdd: 0, solar: 420, wind: 2.0 },
    { month: 9, temp: 19, hdd: 0, solar: 350, wind: 2.5 },
    { month: 10, temp: 12, hdd: 180, solar: 250, wind: 2.8 },
    { month: 11, temp: 4, hdd: 420, solar: 150, wind: 3.2 },
    { month: 12, temp: -3, hdd: 630, solar: 100, wind: 3.5 },
  ];

  return monthlyData.map((d) => ({
    id: `weather-${houseId}-${year}-${d.month}`,
    houseTypeId: houseId,
    month: d.month,
    year,
    avgOutdoorTemp: d.temp,
    heatingDegreeDays: d.hdd,
    solarRadiation: d.solar,
    windSpeed: d.wind,
  }));
};

export const referenceWeatherYear = 2023;
export const actualWeatherYear = 2024;

export const getReferenceWeather = (houseId: string): WeatherData[] => 
  generateWeatherData(houseId, referenceWeatherYear);

export const getActualWeather = (houseId: string): WeatherData[] => {
  const data = generateWeatherData(houseId, actualWeatherYear);
  return data.map((d, i) => ({
    ...d,
    avgOutdoorTemp: d.avgOutdoorTemp + (i < 3 ? 2 : 0),
    heatingDegreeDays: d.heatingDegreeDays + (i < 3 ? -60 : 0),
    solarRadiation: d.solarRadiation + (i === 1 ? 30 : 0),
  }));
};

export const generateSampleConsumptions = (): EnergyConsumption[] => {
  const consumptions: EnergyConsumption[] = [];
  
  const houseConsumptionPatterns = [
    { houseType: sampleHouseTypes[0], baseConsumption: 450, variation: 80 },
    { houseType: sampleHouseTypes[1], baseConsumption: 350, variation: 60 },
    { houseType: sampleHouseTypes[2], baseConsumption: 200, variation: 40 },
    { houseType: sampleHouseTypes[3], baseConsumption: 400, variation: 70 },
  ];

  const heatingMonths = [1, 2, 3, 10, 11, 12];
  const nonHeatingMonths = [4, 5, 6, 7, 8, 9];

  const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

  for (const { houseType, baseConsumption, variation } of houseConsumptionPatterns) {
    for (const month of heatingMonths) {
      const randomVar = (Math.random() - 0.5) * variation;
      const consumption: EnergyConsumption = {
        id: generateId(),
        houseTypeId: houseType.id,
        electricityPriceId: sampleElectricityPrices[0].id,
        weatherDataId: `weather-${houseType.id}-${actualWeatherYear}-${month}`,
        month,
        year: actualWeatherYear,
        kWhConsumed: Math.round(baseConsumption * (1 + randomVar / 1000)),
        targetRoomTemp: 20,
        isConfirmed: true,
        hasError: false,
        dataSource: 'imported',
      };
      consumptions.push(consumption);
    }

    for (const month of nonHeatingMonths) {
      const consumption: EnergyConsumption = {
        id: generateId(),
        houseTypeId: houseType.id,
        electricityPriceId: sampleElectricityPrices[0].id,
        weatherDataId: `weather-${houseType.id}-${actualWeatherYear}-${month}`,
        month,
        year: actualWeatherYear,
        kWhConsumed: Math.round(baseConsumption * 0.15),
        targetRoomTemp: 18,
        isConfirmed: true,
        hasError: false,
        dataSource: 'imported',
      };
      consumptions.push(consumption);
    }
  }

  return consumptions;
};

export const sampleValidCSV = `houseTypeName,priceName,month,year,kWhConsumed,targetRoomTemp
传统土坯房,居民阶梯电价,1,2024,480,20
传统土坯房,居民阶梯电价,2,2024,420,20
传统土坯房,居民阶梯电价,3,2024,350,20
砖瓦房中等保温,居民阶梯电价,1,2024,360,20
砖瓦房中等保温,居民阶梯电价,2,2024,320,20
砖瓦房中等保温,峰谷电价,1,2024,350,20
新建节能房,低碳优惠电价,1,2024,210,20
新建节能房,低碳优惠电价,2,2024,190,20`;

export const sampleDuplicateCSV = `houseTypeName,priceName,month,year,kWhConsumed,targetRoomTemp
传统土坯房,居民阶梯电价,1,2024,480,20
传统土坯房,居民阶梯电价,1,2024,490,20
砖瓦房中等保温,居民阶梯电价,2,2024,320,20`;

export const sampleMissingFieldsCSV = `houseTypeName,priceName,month,year,kWhConsumed,targetRoomTemp
传统土坯房,居民阶梯电价,1,2024,480,
,居民阶梯电价,2,2024,420,20
砖瓦房中等保温,,3,2024,350,20
新建节能房,低碳优惠电价,,2024,190,20`;

export const sampleManualErrorCSV = `houseTypeName,priceName,month,year,kWhConsumed,targetRoomTemp
传统土坯房,居民阶梯电价,1,2024,-100,20
砖瓦房中等保温,居民阶梯电价,2,2024,520,5
新建节能房,低碳优惠电价,3,2024,8000,20
农村别墅型,商业用电,4,2024,200,35`;

export const sampleValidJSON = `[
  {"houseTypeName":"传统土坯房","priceName":"居民阶梯电价","month":1,"year":2024,"kWhConsumed":480,"targetRoomTemp":20},
  {"houseTypeName":"砖瓦房中等保温","priceName":"峰谷电价","month":1,"year":2024,"kWhConsumed":350,"targetRoomTemp":20},
  {"houseTypeName":"新建节能房","priceName":"低碳优惠电价","month":1,"year":2024,"kWhConsumed":210,"targetRoomTemp":20}
]`;
