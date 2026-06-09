import { DETECTION_RECORDS_BY_PACK } from "./src/data/mockData.ts";
import { runAnomalyAlgo } from "./src/utils/anomalyAlgo.ts";

const packId = "pilot-small";
const records = DETECTION_RECORDS_BY_PACK[packId];
console.log("Mock records count:", records.length);
console.log("Time windows:", new Set(records.map(r => r.timeWindow)).size);

const result = runAnomalyAlgo({ rawRecords: records, thresholdMm: 0.8 });
console.log("Summary:", result.summary);
console.log("Bins count:", result.bins.length);
console.log("Boundary recs:", result.records.filter(r => r.status === "boundary").map(r => ({ id: r.id, val: r.rawValue, batch: r.batchId })));
console.log("Anomalous count:", result.records.filter(r => r.status === "anomalous").length);
