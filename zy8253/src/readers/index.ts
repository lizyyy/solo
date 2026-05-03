import * as path from 'path';
import { DataFiles } from '../types';
import { readCabinetsConfig, readRulesConfig } from './yamlReader';
import { readSlotTemperature, readBatteryRegistry } from './csvReader';
import { readSwapEvents } from './jsonlReader';

export interface FilePaths {
  cabinetsYaml: string;
  slotTemperatureCsv: string;
  swapEventsJsonl: string;
  batteryRegistryCsv: string;
  rulesYaml: string;
}

export function getDefaultFilePaths(baseDir: string): FilePaths {
  return {
    cabinetsYaml: path.join(baseDir, 'cabinets.yaml'),
    slotTemperatureCsv: path.join(baseDir, 'slot_temperature.csv'),
    swapEventsJsonl: path.join(baseDir, 'swap_events.jsonl'),
    batteryRegistryCsv: path.join(baseDir, 'battery_registry.csv'),
    rulesYaml: path.join(baseDir, 'rules.yaml'),
  };
}

export async function readAllDataFiles(filePaths: FilePaths): Promise<DataFiles> {
  const [cabinets, temperatures, swapEvents, batteryRegistry, rules] = await Promise.all([
    readCabinetsConfig(filePaths.cabinetsYaml),
    readSlotTemperature(filePaths.slotTemperatureCsv),
    readSwapEvents(filePaths.swapEventsJsonl),
    readBatteryRegistry(filePaths.batteryRegistryCsv),
    readRulesConfig(filePaths.rulesYaml),
  ]);

  return {
    cabinets,
    temperatures,
    swapEvents,
    batteryRegistry,
    rules,
  };
}

export * from './yamlReader';
export * from './csvReader';
export * from './jsonlReader';
