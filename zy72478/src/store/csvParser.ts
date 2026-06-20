import type { BusSwipeRecord, DataSource } from "../../shared/types";
import { LOCATION_TO_AREA } from "../data/mockData";

export function parseCsvText(text: string): Partial<BusSwipeRecord>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].split(/[,，\t]/).map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));
  const iCard = idx("卡号");
  let iTime = idx("时间");
  if (iTime === -1) iTime = idx("刷卡时间");
  const iRoute = idx("线路");
  let iLoc = idx("站点");
  if (iLoc === -1) iLoc = idx("站点");
  const iArea = idx("区域");
  const iSource = idx("口径");
  const result: Partial<BusSwipeRecord>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[,，\t]/).map((c) => c.trim());
    const cardId = cols[iCard >= 0 ? iCard : 0] || "";
    const swipeTime = cols[iTime >= 0 ? iTime : 1] || "";
    const route = cols[iRoute >= 0 ? iRoute : 2] || "";
    const location = cols[iLoc >= 0 ? iLoc : 3] || "";
    const areaName = iArea >= 0 ? cols[iArea] : LOCATION_TO_AREA[location] || "";
    const sourceRaw = iSource >= 0 ? cols[iSource] : "normal";
    const source: DataSource = sourceRaw.includes("补录") ? "supplement" : sourceRaw.includes("错") ? "wrong" : "normal";
    if (cardId && swipeTime) {
      result.push({ cardId, swipeTime, route, location, areaName, source });
    }
  }
  return result;
}
