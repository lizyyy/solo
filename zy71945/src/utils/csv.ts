import Papa from "papaparse";
import type { ImportResult, OrbitalElement, TelemetrySegment, WindowTable } from "@/types";
import { generateId } from "./timeFormat";

function parseFileContent(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function parseCSV(content: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });
  return result.data;
}

function parseJSON(content: string): Record<string, string>[] {
  const data = JSON.parse(content);
  return Array.isArray(data) ? data : [data];
}

export async function parseOrbitalElements(file: File): Promise<ImportResult<OrbitalElement>> {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    const content = await parseFileContent(file);
    const isJson = file.name.endsWith(".json");
    const rows = isJson ? parseJSON(content) : parseCSV(content);

    const data: OrbitalElement[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const epochTime = Number(r.epochTime || r.epoch_time || 0);
      if (!epochTime) {
        errors.push(`第${i + 1}行：epochTime 无效`);
        continue;
      }
      data.push({
        id: generateId(),
        epochTime,
        semiMajorAxis: Number(r.semiMajorAxis || r.semi_major_axis || 0),
        eccentricity: Number(r.eccentricity || 0),
        inclination: Number(r.inclination || 0),
        raan: Number(r.raan || 0),
        argPerigee: Number(r.argPerigee || r.arg_perigee || 0),
        trueAnomaly: Number(r.trueAnomaly || r.true_anomaly || 0),
        source: r.source || file.name,
        importedAt: Date.now(),
      });
    }

    if (data.length === 0 && errors.length === 0) {
      errors.push("文件为空或格式不匹配");
    }

    return { success: errors.length === 0, data, errors, warnings };
  } catch (e) {
    return { success: false, data: [], errors: [`解析失败: ${(e as Error).message}`], warnings };
  }
}

export async function parseTelemetrySegments(file: File): Promise<ImportResult<TelemetrySegment>> {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    const content = await parseFileContent(file);
    const isJson = file.name.endsWith(".json");
    const rows = isJson ? parseJSON(content) : parseCSV(content);

    const data: TelemetrySegment[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const startTime = Number(r.startTime || r.start_time || 0);
      const endTime = Number(r.endTime || r.end_time || 0);
      if (!startTime || !endTime) {
        errors.push(`第${i + 1}行：startTime/endTime 无效`);
        continue;
      }
      const frameCount = Number(r.frameCount || r.frame_count || 0);
      const expectedFrameCount = Number(r.expectedFrameCount || r.expected_frame_count || frameCount);
      if (frameCount < expectedFrameCount) {
        warnings.push(`第${i + 1}行：帧数不足 (${frameCount}/${expectedFrameCount})`);
      }
      data.push({
        id: generateId(),
        startTime,
        endTime,
        starSensorId: r.starSensorId || r.star_sensor_id || "SS-01",
        status: (r.status as TelemetrySegment["status"]) || (frameCount < expectedFrameCount ? "missing" : "normal"),
        frameCount,
        expectedFrameCount,
        source: r.source || file.name,
        importedAt: Date.now(),
      });
    }

    if (data.length > 1) {
      const sorted = [...data].sort((a, b) => a.startTime - b.startTime);
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].startTime > sorted[i - 1].endTime + 1000) {
          warnings.push(`遥测片段 ${sorted[i - 1].starSensorId} 在 ${new Date(sorted[i - 1].endTime).toISOString()} 与 ${new Date(sorted[i].startTime).toISOString()} 之间存在时间间隙`);
        }
      }
    }

    if (data.length === 0 && errors.length === 0) {
      errors.push("文件为空或格式不匹配");
    }

    return { success: errors.length === 0, data, errors, warnings };
  } catch (e) {
    return { success: false, data: [], errors: [`解析失败: ${(e as Error).message}`], warnings };
  }
}

export async function parseWindowTables(file: File): Promise<ImportResult<WindowTable>> {
  const errors: string[] = [];
  const warnings: string[] = [];
  try {
    const content = await parseFileContent(file);
    const isJson = file.name.endsWith(".json");
    const rows = isJson ? parseJSON(content) : parseCSV(content);

    const data: WindowTable[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const startTime = Number(r.startTime || r.start_time || 0);
      const endTime = Number(r.endTime || r.end_time || 0);
      if (!startTime || !endTime) {
        errors.push(`第${i + 1}行：startTime/endTime 无效`);
        continue;
      }
      if (endTime <= startTime) {
        errors.push(`第${i + 1}行：窗口结束时间早于开始时间`);
        continue;
      }
      data.push({
        id: generateId(),
        windowName: r.windowName || r.window_name || `窗口${i + 1}`,
        startTime,
        endTime,
        windowType: r.windowType || r.window_type || "observation",
        importedAt: Date.now(),
      });
    }

    if (data.length === 0 && errors.length === 0) {
      errors.push("文件为空或格式不匹配");
    }

    return { success: errors.length === 0, data, errors, warnings };
  } catch (e) {
    return { success: false, data: [], errors: [`解析失败: ${(e as Error).message}`], warnings };
  }
}
