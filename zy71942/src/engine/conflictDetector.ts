import type {
  PayloadPlan,
  GroundStationSchedule,
  ConflictItem,
  ConflictType,
} from "@/types";

export function detectConflicts(
  plans: PayloadPlan[],
  _schedules: GroundStationSchedule[]
): ConflictItem[] {
  const conflicts: ConflictItem[] = [];
  const now = new Date().toISOString();

  for (const plan of plans) {
    detectWindowOverlaps(plan, conflicts, now);
    detectTelemetryFrameDrops(plan, conflicts, now);
    detectTimeSystemMixed(plan, conflicts, now);
  }

  return conflicts;
}

function detectWindowOverlaps(
  plan: PayloadPlan,
  conflicts: ConflictItem[],
  now: string
): void {
  const allWindows = [...plan.windows];
  const byStation = new Map<string, typeof allWindows>();
  for (const w of allWindows) {
    const arr = byStation.get(w.stationName) || [];
    arr.push(w);
    byStation.set(w.stationName, arr);
  }

  for (const [, windows] of byStation) {
    const sorted = [...windows].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const end = new Date(sorted[i].endTime).getTime();
      const nextStart = new Date(sorted[i + 1].startTime).getTime();
      if (end > nextStart) {
        const overlapMin = Math.round((end - nextStart) / 60000);
        conflicts.push({
          id: crypto.randomUUID(),
          type: "window_overlap" as ConflictType,
          status: "pending",
          stationName: sorted[i].stationName,
          description: `站${sorted[i].stationName}的窗口${sorted[i].id}与${sorted[i + 1].id}重叠${overlapMin}分钟`,
          humanMessage: `站${sorted[i].stationName}的${sorted[i].startTime}~${sorted[i].endTime}窗口与${sorted[i + 1].startTime}~${sorted[i + 1].endTime}窗口重叠${overlapMin}分钟，请确认优先级`,
          relatedWindowIds: [sorted[i].id, sorted[i + 1].id],
          payloadPlanId: plan.id,
          payloadPlanVersion: plan.version,
          detectedAt: now,
        });
      }
    }
  }
}

function detectTelemetryFrameDrops(
  plan: PayloadPlan,
  conflicts: ConflictItem[],
  now: string
): void {
  for (const seg of plan.telemetrySegments) {
    if (seg.actualFrames < seg.expectedFrames) {
      const dropped = seg.expectedFrames - seg.actualFrames;
      conflicts.push({
        id: crypto.randomUUID(),
        type: "telemetry_frame_drop" as ConflictType,
        status: "pending",
        stationName: seg.stationName,
        description: `站${seg.stationName}时段${seg.startTime}~${seg.endTime}遥测缺帧${dropped}帧`,
        humanMessage: `该站${seg.stationName}时段${seg.startTime}~${seg.endTime}遥测数据缺失${dropped}帧，可能影响下行解调，请确认`,
        relatedWindowIds: [],
        payloadPlanId: plan.id,
        payloadPlanVersion: plan.version,
        detectedAt: now,
      });
    }
  }
}

function detectTimeSystemMixed(
  plan: PayloadPlan,
  conflicts: ConflictItem[],
  now: string
): void {
  const systems = new Set<string>();
  const allItems = [...plan.windows, ...plan.telemetrySegments];
  for (const item of allItems) {
    if (item.timeSystem && item.timeSystem !== "UNKNOWN") {
      systems.add(item.timeSystem);
    }
  }
  if (systems.size > 1) {
    const systemNames = Array.from(systems).join("与");
    const mixedCount = allItems.filter(
      (item) => item.timeSystem && item.timeSystem !== "UNKNOWN"
    ).length;
    conflicts.push({
      id: crypto.randomUUID(),
      type: "time_system_mixed" as ConflictType,
      status: "pending",
      stationName: "-",
      description: `载荷计划「${plan.name}」中${systemNames}混用`,
      humanMessage: `同一计划中${systemNames}混用，${mixedCount}条记录时间基准不一致`,
      relatedWindowIds: allItems.map((item) => item.id),
      payloadPlanId: plan.id,
      payloadPlanVersion: plan.version,
      detectedAt: now,
    });
  }
}
