import * as XLSX from "xlsx";
import type { BusSwipeRecord, DataSource } from "../../shared/types";
import { LOCATION_TO_AREA } from "../data/mockData";

export function parseExcelData(jsonData: any[]): Partial<BusSwipeRecord>[] {
  return jsonData.map((row: any) => {
    const cardId = String(row["卡号"] || row["cardId"] || "");
    const swipeTime = String(row["刷卡时间"] || row["时间"] || row["swipeTime"] || "");
    const route = String(row["线路"] || row["route"] || "");
    const location = String(row["站点"] || row["location"] || "");
    const areaName = String(row["区域"] || row["areaName"] || LOCATION_TO_AREA[location] || "");
    const sourceRaw = String(row["数据口径"] || row["口径"] || row["source"] || "normal");
    const source: DataSource = sourceRaw.includes("补录") ? "supplement" : sourceRaw.includes("错") ? "wrong" : "normal";
    return { cardId, swipeTime, route, location, areaName, source };
  }).filter((r) => r.cardId && r.swipeTime);
}

export async function parseExcelFile(file: File): Promise<Partial<BusSwipeRecord>[]> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheet];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      resolve(parseExcelData(jsonData));
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
