import type {
  Sortie,
  InspectionPhoto,
  KmlRoute,
  SwapPoint,
  NoflyZone,
  Confirmation,
  FlightReview,
  ReviewDataPoint,
  AnomalyRange,
  ImportBatch,
  AuditLog,
  AnomalyTag,
} from "@/types";

const BASE_TS = 1717200000000;

const IMG_BASE =
  "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?image_size=landscape_16_9&prompt=";

const prompts = [
  encodeURIComponent("drone aerial view of battery swap station on rooftop, industrial inspection photo"),
  encodeURIComponent("drone inspection photo of power line battery swap point, aerial photography"),
  encodeURIComponent("aerial drone photo of battery charging pad at night with LED indicators, inspection"),
  encodeURIComponent("drone close-up photo of mechanical battery swap mechanism, technical inspection"),
  encodeURIComponent("drone inspection image of no-fly zone boundary marker on building rooftop"),
];

function imgUrl(i: number): string {
  return `${IMG_BASE}${prompts[i % prompts.length]}`;
}

const batchIds = ["batch-001", "batch-002"];
const operators = ["张伟", "李明", "王芳"];

const sortieDefs: {
  no: string;
  battery: string;
  status: Sortie["status"];
  tags: AnomalyTag[];
  batchIdx: number;
  dayOffset: number;
}[] = [
  { no: "SRT-2025-001", battery: "BAT-A1001", status: "normal", tags: [], batchIdx: 0, dayOffset: 0 },
  { no: "SRT-2025-002", battery: "BAT-A1002", status: "normal", tags: [], batchIdx: 0, dayOffset: 1 },
  { no: "SRT-2025-003", battery: "BAT-B2001", status: "pending", tags: ["battery_cycle_error"], batchIdx: 0, dayOffset: 3 },
  { no: "SRT-2025-004", battery: "BAT-B2002", status: "pending", tags: ["rth_point_lost"], batchIdx: 1, dayOffset: 5 },
  { no: "SRT-2025-005", battery: "BAT-C3001", status: "abnormal", tags: ["battery_cycle_error", "nofly_zone_edge"], batchIdx: 1, dayOffset: 7 },
  { no: "SRT-2025-006", battery: "BAT-C3002", status: "abnormal", tags: ["rth_point_lost", "other"], batchIdx: 1, dayOffset: 10 },
];

function genSwapPoints(kmlId: string, baseTs: number): SwapPoint[] {
  const offsets = [180000, 420000, 720000];
  const latBase = 31.23;
  const lngBase = 121.47;
  return offsets.map((off, i) => ({
    id: `sp-${kmlId}-${i}`,
    kmlRouteId: kmlId,
    lat: latBase + (i + 1) * 0.008,
    lng: lngBase + (i + 1) * 0.012,
    altitude: 50 + i * 30,
    timestamp: baseTs + off,
  }));
}

function genNoflyZones(kmlId: string): NoflyZone[] {
  return [
    {
      id: `nfz-${kmlId}-1`,
      kmlRouteId: kmlId,
      centerLat: 31.245,
      centerLng: 121.49,
      radiusMeters: 500,
      minDistance: 32,
    },
  ];
}

function genCoordinates(): [number, number][] {
  const coords: [number, number][] = [];
  const latBase = 31.20;
  const lngBase = 121.45;
  for (let i = 0; i < 10; i++) {
    coords.push([
      latBase + i * 0.005 + Math.sin(i * 0.8) * 0.003,
      lngBase + i * 0.01 + Math.cos(i * 0.6) * 0.005,
    ]);
  }
  return coords;
}

function genDataPoints(baseTs: number, hasAnomaly: boolean): ReviewDataPoint[] {
  const points: ReviewDataPoint[] = [];
  for (let i = 0; i < 20; i++) {
    const voltageDrop = hasAnomaly && i >= 10 && i <= 14 ? 2.5 + Math.random() * 1.5 : 0;
    points.push({
      timestamp: baseTs + i * 30000,
      voltage: Math.max(18, 25.2 - i * 0.15 - voltageDrop + (Math.random() - 0.5) * 0.3),
      altitude: 80 + Math.sin(i * 0.5) * 15 + (Math.random() - 0.5) * 5,
      speed: 8 + Math.random() * 4,
    });
  }
  return points;
}

function genAnomalyRanges(
  baseTs: number,
  tags: AnomalyTag[],
  photos: InspectionPhoto[],
): AnomalyRange[] {
  if (tags.length === 0) return [];
  return tags.map((tag, i) => ({
    id: `ar-${baseTs}-${i}`,
    startTimestamp: baseTs + 300000 + i * 180000,
    endTimestamp: baseTs + 420000 + i * 180000,
    type: tag,
    linkedPhotoId: photos.length > i ? photos[i].id : null,
    linkedKmlSegmentId: null,
  }));
}

export function generateMockData() {
  const sorties: Sortie[] = [];
  const photos: InspectionPhoto[] = [];
  const kmlRoutes: KmlRoute[] = [];
  const confirmations: Confirmation[] = [];
  const flightReviews: FlightReview[] = [];
  const importBatches: ImportBatch[] = [
    {
      id: batchIds[0],
      timestamp: BASE_TS - 86400000,
      fileCount: 8,
      fileHashes: [
        "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        "b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
      ],
      status: "active",
    },
    {
      id: batchIds[1],
      timestamp: BASE_TS + 5 * 86400000,
      fileCount: 12,
      fileHashes: [
        "c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
        "d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5",
      ],
      status: "active",
    },
  ];
  const auditLogs: AuditLog[] = [
    {
      id: "log-001",
      action: "import",
      operator: operators[0],
      timestamp: BASE_TS - 86400000,
      detail: "导入批次 batch-001，包含 8 个文件",
      batchId: batchIds[0],
    },
    {
      id: "log-002",
      action: "confirm",
      operator: operators[1],
      timestamp: BASE_TS + 2 * 86400000,
      detail: "确认架次 SRT-2025-001 的照片证据",
      sortieId: "sortie-1",
    },
    {
      id: "log-003",
      action: "import",
      operator: operators[0],
      timestamp: BASE_TS + 5 * 86400000,
      detail: "导入批次 batch-002，包含 12 个文件",
      batchId: batchIds[1],
    },
    {
      id: "log-004",
      action: "status_change",
      operator: operators[2],
      timestamp: BASE_TS + 8 * 86400000,
      detail: "将架次 SRT-2025-005 状态变更为异常",
      sortieId: "sortie-5",
    },
    {
      id: "log-005",
      action: "export",
      operator: operators[1],
      timestamp: BASE_TS + 11 * 86400000,
      detail: "导出异常架次报告",
    },
  ];

  for (let i = 0; i < sortieDefs.length; i++) {
    const def = sortieDefs[i];
    const sortieTs = BASE_TS + def.dayOffset * 86400000;
    const sortieId = `sortie-${i + 1}`;

    sorties.push({
      id: sortieId,
      sortieNo: def.no,
      batteryId: def.battery,
      timestamp: sortieTs,
      status: def.status,
      anomalyTags: def.tags,
      importBatchId: batchIds[def.batchIdx],
    });

    const photoCount = 3 + Math.floor(Math.random() * 3);
    const sortiePhotos: InspectionPhoto[] = [];
    for (let p = 0; p < photoCount; p++) {
      const photoId = `photo-${sortieId}-${p + 1}`;
      const hasGps = Math.random() > 0.3;
      sortiePhotos.push({
        id: photoId,
        sortieId,
        fileName: `DJI_${def.no.replace(/-/g, "")}_${String(p + 1).padStart(4, "0")}.JPG`,
        fileHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
        thumbnailUrl: imgUrl(i * photoCount + p),
        fullImageUrl: imgUrl(i * photoCount + p),
        exifTimestamp: sortieTs + p * 60000,
        exifGps: hasGps
          ? { lat: 31.22 + Math.random() * 0.05, lng: 121.47 + Math.random() * 0.06 }
          : null,
        annotations: [],
      });
    }
    photos.push(...sortiePhotos);

    const kmlId = `kml-${sortieId}`;
    kmlRoutes.push({
      id: kmlId,
      sortieId,
      fileName: `route_${def.no.replace(/-/g, "_")}.kml`,
      fileHash: Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
      coordinates: genCoordinates(),
      swapPoints: genSwapPoints(kmlId, sortieTs),
      noflyZones: def.tags.includes("nofly_zone_edge") ? genNoflyZones(kmlId) : [],
      rthPoint: def.tags.includes("rth_point_lost") ? null : { lat: 31.205, lng: 121.455 },
    });

    const dataPoints = genDataPoints(sortieTs, def.status === "abnormal");
    const anomalyRanges = genAnomalyRanges(sortieTs, def.tags, sortiePhotos);
    flightReviews.push({
      id: `review-${sortieId}`,
      sortieId,
      dataPoints,
      anomalyRanges,
    });

    if (def.status === "normal" || def.status === "abnormal") {
      confirmations.push({
        id: `conf-${sortieId}`,
        sortieId,
        status: def.status === "normal" ? "confirmed" : "rejected",
        evidenceType: "photo",
        evidenceId: sortiePhotos[0].id,
        operator: operators[i % operators.length],
        timestamp: sortieTs + 86400000,
        note:
          def.status === "normal"
            ? "换电过程正常，照片证据已确认"
            : "检测到异常，照片证据未通过确认",
      });
    }
  }

  return { sorties, photos, kmlRoutes, confirmations, flightReviews, importBatches, auditLogs };
}
