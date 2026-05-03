import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Plant, Pot, Weather, WateringPlan, WateringEvent } from '../types';

export interface ParsedInputData {
  plants: Plant[];
  pots: Pot[];
  weather: Weather[];
  wateringPlans: WateringPlan[];
}

export class InputParser {
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  resolvePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(this.basePath, filePath);
  }

  fileExists(filePath: string): boolean {
    const resolvedPath = this.resolvePath(filePath);
    return fs.existsSync(resolvedPath);
  }

  readFile(filePath: string): string {
    const resolvedPath = this.resolvePath(filePath);
    if (!this.fileExists(resolvedPath)) {
      throw new Error(`文件不存在: ${resolvedPath}`);
    }
    return fs.readFileSync(resolvedPath, 'utf-8');
  }

  parseCSV<T>(csvContent: string): T[] {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records as T[];
  }

  parseJSON<T>(jsonContent: string): T {
    return JSON.parse(jsonContent) as T;
  }

  parsePlants(csvContent: string): Plant[] {
    const rawRecords = this.parseCSV<Record<string, string>>(csvContent);
    
    return rawRecords.map((record, index) => {
      return {
        id: this.parseString(record.id, `plants[${index}].id`),
        name: this.parseString(record.name, `plants[${index}].name`),
        variety: this.parseString(record.variety, `plants[${index}].variety`),
        growthStage: this.parseString(record.growthStage, `plants[${index}].growthStage`),
        minMoisture: this.parseNumber(record.minMoisture, `plants[${index}].minMoisture`),
        maxMoisture: this.parseNumber(record.maxMoisture, `plants[${index}].maxMoisture`),
        optimalMoisture: this.parseNumber(record.optimalMoisture, `plants[${index}].optimalMoisture`),
        waterNeedCoefficient: this.parseNumber(record.waterNeedCoefficient, `plants[${index}].waterNeedCoefficient`),
        lightNeed: this.parseNumber(record.lightNeed, `plants[${index}].lightNeed`),
      };
    });
  }

  parsePots(jsonContent: string): Pot[] {
    const data = this.parseJSON<{ pots: Pot[] }>(jsonContent);
    return data.pots;
  }

  parseWeather(csvContent: string): Weather[] {
    const rawRecords = this.parseCSV<Record<string, string>>(csvContent);
    
    return rawRecords.map((record, index) => {
      return {
        date: this.parseString(record.date, `weather[${index}].date`),
        temperature: this.parseNumber(record.temperature, `weather[${index}].temperature`),
        humidity: this.parseNumber(record.humidity, `weather[${index}].humidity`),
        solarRadiation: this.parseNumber(record.solarRadiation, `weather[${index}].solarRadiation`),
        windSpeed: this.parseNumber(record.windSpeed, `weather[${index}].windSpeed`),
        precipitation: this.parseNumber(record.precipitation, `weather[${index}].precipitation`),
      };
    });
  }

  parseWateringPlan(jsonContent: string): WateringPlan {
    const data = this.parseJSON<WateringPlan>(jsonContent);
    return data;
  }

  parseWateringPlansFromDirectory(directoryPath: string): WateringPlan[] {
    const resolvedDir = this.resolvePath(directoryPath);
    const plans: WateringPlan[] = [];
    
    if (!fs.existsSync(resolvedDir)) {
      return plans;
    }

    const files = fs.readdirSync(resolvedDir);
    for (const file of files) {
      if (file.endsWith('.json') && file.includes('watering-plan')) {
        const filePath = path.join(resolvedDir, file);
        const content = this.readFile(filePath);
        const plan = this.parseWateringPlan(content);
        plans.push(plan);
      }
    }

    return plans;
  }

  parseAll(
    plantsPath: string = 'plants.csv',
    potsPath: string = 'pots.json',
    weatherPath: string = 'weather.csv',
    wateringPlanPaths: string[] = ['watering-plan.json']
  ): ParsedInputData {
    const plants = this.parsePlants(this.readFile(plantsPath));
    const pots = this.parsePots(this.readFile(potsPath));
    const weather = this.parseWeather(this.readFile(weatherPath));
    
    const wateringPlans: WateringPlan[] = [];
    for (const planPath of wateringPlanPaths) {
      if (this.fileExists(planPath)) {
        const content = this.readFile(planPath);
        const plan = this.parseWateringPlan(content);
        wateringPlans.push(plan);
      }
    }

    return {
      plants,
      pots,
      weather,
      wateringPlans,
    };
  }

  private parseString(value: string | undefined, fieldPath: string): string {
    if (value === undefined || value === null || value.trim() === '') {
      throw new Error(`字段 ${fieldPath} 不能为空`);
    }
    return String(value).trim();
  }

  private parseNumber(value: string | number | undefined, fieldPath: string): number {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      throw new Error(`字段 ${fieldPath} 不能为空`);
    }
    
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`字段 ${fieldPath} 值 "${value}" 不是有效数字`);
    }
    
    return num;
  }
}
