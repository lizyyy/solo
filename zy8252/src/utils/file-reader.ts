import * as fs from "fs";
import * as path from "path";
import csvParser from "csv-parser";
import * as yaml from "js-yaml";
import {
  Buoy,
  BatteryLog,
  Repair,
  WeatherRecord,
  LampRulesConfig,
  InputFiles,
} from "../types";

export interface ReadOptions {
  dataDir: string;
}

export async function readCSV<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data: T) => results.push(data))
      .on("end", () => resolve(results))
      .on("error", (error: Error) => reject(error));
  });
}

export async function readJSONL<T>(filePath: string): Promise<T[]> {
  const content = await fs.promises.readFile(filePath, "utf-8");
  const lines = content.split("\n").filter((line) => line.trim());
  return lines.map((line) => JSON.parse(line));
}

export async function readYAML<T>(filePath: string): Promise<T> {
  const content = await fs.promises.readFile(filePath, "utf-8");
  return yaml.load(content) as T;
}

export async function readAllFiles(options: ReadOptions): Promise<InputFiles> {
  const { dataDir } = options;

  const buoysPath = path.join(dataDir, "buoys.csv");
  const batteryLogsPath = path.join(dataDir, "battery_logs.jsonl");
  const repairsPath = path.join(dataDir, "repairs.csv");
  const weatherPath = path.join(dataDir, "weather.csv");
  const lampRulesPath = path.join(dataDir, "lamp_rules.yaml");

  const [buoysRaw, batteryLogsRaw, repairsRaw, weatherRecordsRaw, lampRules] =
    await Promise.all([
      readCSV<Record<string, string>>(buoysPath),
      readJSONL<BatteryLog>(batteryLogsPath),
      readCSV<Record<string, string>>(repairsPath),
      readCSV<Record<string, string>>(weatherPath),
      readYAML<LampRulesConfig>(lampRulesPath),
    ]);

  const buoys: Buoy[] = buoysRaw.map((row, index) => ({
    id: row.id || `BUOY-${index + 1}`,
    name: row.name || "",
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    type: row.type || "unknown",
    battery_capacity: parseFloat(row.battery_capacity) || 100,
    lamp_type: row.lamp_type || "default",
    install_date: row.install_date || "",
  }));

  const repairs: Repair[] = repairsRaw.map((row) => ({
    id: row.id || "",
    buoy_id: row.buoy_id || "",
    repair_date: row.repair_date || "",
    technician: row.technician || "",
    issue_type: row.issue_type || "",
    description: row.description || "",
    resolved: row.resolved === "true" || row.resolved === "TRUE" || row.resolved === "1",
    resolution_date: row.resolution_date || null,
  }));

  const weatherRecords: WeatherRecord[] = weatherRecordsRaw.map((row) => ({
    date: row.date || "",
    time: row.time || "",
    wind_speed: parseFloat(row.wind_speed) || 0,
    wind_direction: row.wind_direction || "",
    visibility: parseFloat(row.visibility) || 10000,
    wave_height: parseFloat(row.wave_height) || 0,
    weather_condition: row.weather_condition || "clear",
    is_severe:
      row.is_severe === "true" ||
      row.is_severe === "TRUE" ||
      row.is_severe === "1" ||
      parseFloat(row.wind_speed) > 30 ||
      parseFloat(row.visibility) < 1000,
  }));

  return {
    buoys,
    batteryLogs: batteryLogsRaw,
    repairs,
    weatherRecords,
    lampRules,
  };
}
