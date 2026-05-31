import type {
  OrbitalElement,
  TelemetrySegment,
  WindowTable,
  OcclusionEvent,
  MissingFrameAlert,
  Confidence,
  DataSource,
} from "@/types";
import { generateId } from "./timeFormat";

interface AnalysisInput {
  orbitalElements: OrbitalElement[];
  telemetrySegments: TelemetrySegment[];
  windowTables: WindowTable[];
}

function computeOcclusionFromGeometry(oe: OrbitalElement): boolean {
  const degToRad = Math.PI / 180;
  const inc = oe.inclination * degToRad;
  const raan = oe.raan * degToRad;
  const argP = oe.argPerigee * degToRad;
  const sinInc = Math.sin(inc);
  const cosArgP = Math.cos(argP);
  const sinRaan = Math.sin(raan);
  const shadowAngle = Math.abs(sinInc * cosArgP * sinRaan);
  return shadowAngle > 0.7;
}

function detectMissingFrames(segments: TelemetrySegment[]): TelemetrySegment[] {
  return segments.filter((s) => s.frameCount < s.expectedFrameCount);
}

export function analyzeOcclusion(input: AnalysisInput): {
  events: OcclusionEvent[];
  alerts: MissingFrameAlert[];
} {
  const { orbitalElements, telemetrySegments, windowTables } = input;
  const events: OcclusionEvent[] = [];
  const alerts: MissingFrameAlert[] = [];
  const now = Date.now();

  const sortedSegments = [...telemetrySegments].sort((a, b) => a.startTime - b.startTime);

  for (const seg of sortedSegments) {
    if (seg.status === "occluded") {
      const relatedOE = orbitalElements.find(
        (oe) => Math.abs(oe.epochTime - seg.startTime) < 86400000
      );
      const isGeometric = relatedOE ? computeOcclusionFromGeometry(relatedOE) : false;

      const dataSource: DataSource = isGeometric
        ? relatedOE
          ? "combined"
          : "telemetry"
        : "telemetry";
      const confidence: Confidence = isGeometric ? "high" : relatedOE ? "medium" : "low";

      let reason = "";
      if (isGeometric && relatedOE) {
        reason = `轨道几何判定遮挡：轨道倾角 ${relatedOE.inclination.toFixed(2)}°，升交点赤经 ${relatedOE.raan.toFixed(2)}°，近地点幅角 ${relatedOE.argPerigee.toFixed(2)}°，卫星进入地影或结构遮挡区域。`;
      } else {
        reason = `遥测判定遮挡：星敏感器 ${seg.starSensorId} 在该时段信号异常，帧数 ${seg.frameCount}/${seg.expectedFrameCount}，疑似遮挡。`;
      }

      const matchingWindow = windowTables.find(
        (w) => seg.startTime >= w.startTime && seg.endTime <= w.endTime
      );
      if (matchingWindow) {
        reason += ` 该时段位于窗口"${matchingWindow.windowName}"内。`;
      }

      let guideline = "";
      if (confidence === "high") {
        guideline = "几何与遥测一致确认遮挡，建议标注为已确认，后续关注出影时刻。";
      } else if (confidence === "medium") {
        guideline = "部分数据支持遮挡判断，建议补充轨道根数后复核确认。";
      } else {
        guideline = "仅遥测支撑，建议核实轨道根数并补充遥测帧后重新判断。";
      }

      const event: OcclusionEvent = {
        id: generateId(),
        startTime: seg.startTime,
        endTime: seg.endTime,
        reason,
        dataSource,
        confidence,
        status: "pending",
        handlingGuideline: guideline,
        analyzedAt: now,
      };
      events.push(event);

      if (seg.frameCount < seg.expectedFrameCount) {
        alerts.push({
          id: generateId(),
          occlusionEventId: event.id,
          source: "telemetry_segment",
          description: `遥测片段缺帧：${seg.starSensorId} 实际帧数 ${seg.frameCount}，期望帧数 ${seg.expectedFrameCount}，缺 ${seg.expectedFrameCount - seg.frameCount} 帧。`,
          nextStep: "请联系测控组补充该时段遥测数据。",
          responsible: "测控组",
          createdAt: now,
        });
      }

      if (!relatedOE && isGeometric === false) {
        alerts.push({
          id: generateId(),
          occlusionEventId: event.id,
          source: "orbital_elements",
          description: `缺少对应轨道根数：该遮挡时段附近无轨道根数数据，无法进行几何判断。`,
          nextStep: "请联系轨道组补充对应时段的轨道根数。",
          responsible: "轨道组",
          createdAt: now,
        });
      }
    }
  }

  for (const oe of orbitalElements) {
    if (computeOcclusionFromGeometry(oe)) {
      const hasTelemetry = sortedSegments.some(
        (s) => Math.abs(s.startTime - oe.epochTime) < 86400000
      );
      if (!hasTelemetry) {
        const segDuration = 3600000;
        const event: OcclusionEvent = {
          id: generateId(),
          startTime: oe.epochTime,
          endTime: oe.epochTime + segDuration,
          reason: `轨道几何判定遮挡：轨道倾角 ${oe.inclination.toFixed(2)}°，升交点赤经 ${oe.raan.toFixed(2)}°，近地点幅角 ${oe.argPerigee.toFixed(2)}°。无对应遥测数据验证。`,
          dataSource: "orbital",
          confidence: "low",
          status: "pending",
          handlingGuideline: "仅轨道根数支撑，缺少遥测验证，建议补充遥测后重新判断。",
          analyzedAt: now,
        };
        events.push(event);
        alerts.push({
          id: generateId(),
          occlusionEventId: event.id,
          source: "telemetry_segment",
          description: `缺少遥测验证：轨道根数判定遮挡但无对应遥测片段，无法交叉验证。`,
          nextStep: "请联系测控组补充该时段遥测数据以验证遮挡。",
          responsible: "测控组",
          createdAt: now,
        });
      }
    }
  }

  const missingFrames = detectMissingFrames(telemetrySegments);
  for (const mf of missingFrames) {
    if (mf.status !== "occluded") {
      const existingAlert = alerts.find((a) =>
        a.source === "telemetry_segment" &&
        a.description.includes(mf.starSensorId)
      );
      if (!existingAlert) {
        alerts.push({
          id: generateId(),
          occlusionEventId: "",
          source: "telemetry_segment",
          description: `遥测缺帧（未遮挡）：${mf.starSensorId} 实际帧数 ${mf.frameCount}，期望帧数 ${mf.expectedFrameCount}。`,
          nextStep: "请联系测控组确认缺帧原因。",
          responsible: "测控组",
          createdAt: now,
        });
      }
    }
  }

  return { events, alerts };
}
