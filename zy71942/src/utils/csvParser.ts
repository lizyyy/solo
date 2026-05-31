import type { TimeWindow, TelemetrySegment } from "@/types";

export function parseImportFile(
  text: string,
  filename: string
): { windows: TimeWindow[]; telemetrySegments: TelemetrySegment[] } {
  const ext = filename.split(".").pop()?.toLowerCase();

  if (ext === "json") {
    return parseJSON(text);
  }

  if (ext === "csv") {
    return parseCSV(text);
  }

  throw new Error(`文件解析失败：不支持的文件格式「${ext ?? "未知"}」，仅支持 JSON 和 CSV`);
}

function parseJSON(
  text: string
): { windows: TimeWindow[]; telemetrySegments: TelemetrySegment[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("文件解析失败：JSON 格式错误，无法解析");
  }

  const obj = data as Record<string, unknown>;
  const rawWindows = Array.isArray(obj.windows) ? obj.windows : [];
  const rawSegments = Array.isArray(obj.telemetrySegments) ? obj.telemetrySegments : [];

  const windows: TimeWindow[] = rawWindows.map((w: Record<string, unknown>, i: number) => {
    if (!w.stationName || !w.startTime || !w.endTime) {
      throw new Error(`文件解析失败：第 ${i + 1} 个时间窗口缺少必要字段（站址、开始时间、结束时间）`);
    }
    return {
      id: (w.id as string) || crypto.randomUUID(),
      stationName: w.stationName as string,
      startTime: w.startTime as string,
      endTime: w.endTime as string,
      timeSystem: (w.timeSystem as TimeWindow["timeSystem"]) || "UNKNOWN",
      ...(w.description ? { description: w.description as string } : {}),
    };
  });

  const telemetrySegments: TelemetrySegment[] = rawSegments.map(
    (s: Record<string, unknown>, i: number) => {
      if (!s.stationName || !s.startTime || !s.endTime) {
        throw new Error(
          `文件解析失败：第 ${i + 1} 个遥测段缺少必要字段（站址、开始时间、结束时间）`
        );
      }
      return {
        id: (s.id as string) || crypto.randomUUID(),
        stationName: s.stationName as string,
        startTime: s.startTime as string,
        endTime: s.endTime as string,
        timeSystem: (s.timeSystem as TelemetrySegment["timeSystem"]) || "UNKNOWN",
        expectedFrames: Number(s.expectedFrames ?? 0),
        actualFrames: Number(s.actualFrames ?? 0),
      };
    }
  );

  return { windows, telemetrySegments };
}

function parseCSV(
  text: string
): { windows: TimeWindow[]; telemetrySegments: TelemetrySegment[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) {
    throw new Error("文件解析失败：CSV 文件至少需要包含标题行和一行数据");
  }

  const header = splitCSVLine(lines[0]);
  const hasTelemetry =
    header.some((h) => h.trim().toLowerCase() === "expectedframes") &&
    header.some((h) => h.trim().toLowerCase() === "actualframes");

  const idx = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));

  const windows: TimeWindow[] = [];
  const telemetrySegments: TelemetrySegment[] = [];

  for (let r = 1; r < lines.length; r++) {
    const cols = splitCSVLine(lines[r]);

    const stationName = getCol(cols, idx, "stationname");
    const startTime = getCol(cols, idx, "starttime");
    const endTime = getCol(cols, idx, "endtime");

    if (!stationName || !startTime || !endTime) {
      throw new Error(
        `文件解析失败：第 ${r + 1} 行格式错误，缺少站址、开始时间或结束时间`
      );
    }

    const timeSystem = getCol(cols, idx, "timesystem") || "UNKNOWN";

    if (hasTelemetry) {
      const expectedFrames = parseInt(getCol(cols, idx, "expectedframes") || "0", 10);
      const actualFrames = parseInt(getCol(cols, idx, "actualframes") || "0", 10);

      if (isNaN(expectedFrames) || isNaN(actualFrames)) {
        throw new Error(
          `文件解析失败：第 ${r + 1} 行格式错误，期望帧数或实际帧数不是有效数字`
        );
      }

      telemetrySegments.push({
        id: crypto.randomUUID(),
        stationName,
        startTime,
        endTime,
        timeSystem: timeSystem as TelemetrySegment["timeSystem"],
        expectedFrames,
        actualFrames,
      });
    } else {
      windows.push({
        id: crypto.randomUUID(),
        stationName,
        startTime,
        endTime,
        timeSystem: timeSystem as TimeWindow["timeSystem"],
        ...(getCol(cols, idx, "description")
          ? { description: getCol(cols, idx, "description")! }
          : {}),
      });
    }
  }

  return { windows, telemetrySegments };
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }

  result.push(current);
  return result;
}

function getCol(
  cols: string[],
  idx: Map<string, number>,
  name: string
): string | undefined {
  const i = idx.get(name);
  if (i === undefined || i >= cols.length) return undefined;
  return cols[i].trim();
}
