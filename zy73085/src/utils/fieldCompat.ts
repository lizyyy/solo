import {
  MeetingMinutes,
  FieldMapping,
  FIELD_COMPAT_RULES,
  STATUS_ENUM_VALUES,
  MinutesStatus,
} from "@/types";

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a.toLowerCase(), b.toLowerCase()) / maxLen;
}

function normalizeKey(k: string): string {
  return k.toLowerCase().replace(/[_\s-]/g, "");
}

interface ParseResult {
  parsedData: Record<string, any>;
  fieldMappings: FieldMapping[];
  source: string;
  status: MinutesStatus;
}

export function parseRawMinutes(raw: Record<string, any>): ParseResult {
  const parsedData: Record<string, any> = {};
  const fieldMappings: FieldMapping[] = [];
  const usedOriginals = new Set<string>();

  const originalKeys = Object.keys(raw);
  const rules = FIELD_COMPAT_RULES;

  for (const rule of rules) {
    let matched: { key: string; confidence: number; round: FieldMapping["matchRound"] } | null = null;

    for (const origKey of originalKeys) {
      if (usedOriginals.has(origKey)) continue;
      const nk = normalizeKey(origKey);
      const canonicalNorm = normalizeKey(rule.canonicalName);

      if (nk === canonicalNorm) {
        matched = { key: origKey, confidence: 1.0, round: "exact" };
        break;
      }

      for (const alias of rule.aliases) {
        const aliasNorm = normalizeKey(alias);
        if (nk === aliasNorm) {
          matched = { key: origKey, confidence: 0.95, round: "alias" };
          break;
        }
      }
      if (matched && matched.round === "alias") break;

      const sim1 = similarity(nk, canonicalNorm);
      if (sim1 >= rule.confidenceThreshold) {
        if (!matched || sim1 > matched.confidence) {
          matched = { key: origKey, confidence: sim1, round: "fuzzy" };
        }
      }
      for (const alias of rule.aliases) {
        const sim2 = similarity(nk, normalizeKey(alias));
        if (sim2 >= rule.confidenceThreshold) {
          if (!matched || sim2 > matched.confidence) {
            matched = { key: origKey, confidence: sim2, round: "fuzzy" };
          }
        }
      }
    }

    if (matched) {
      parsedData[rule.canonicalName] = raw[matched.key];
      fieldMappings.push({
        originalName: matched.key,
        canonicalName: rule.canonicalName,
        confidence: matched.confidence,
        matchRound: matched.round,
      });
      usedOriginals.add(matched.key);
    }
  }

  for (const origKey of originalKeys) {
    if (!usedOriginals.has(origKey)) {
      parsedData[`raw_${origKey}`] = raw[origKey];
    }
  }

  let source: string = parsedData.source;
  if (!source || String(source).trim().length === 0) {
    for (const origKey of originalKeys) {
      const val = raw[origKey];
      if (typeof val === "string" && val.length >= 8) {
        source = val;
        fieldMappings.push({
          originalName: origKey,
          canonicalName: "source",
          confidence: 0.5,
          matchRound: "fallback",
        });
        break;
      }
    }
    if (!source) {
      source = "未标注来源";
    }
  }

  let status: MinutesStatus = parsedData.status;
  let statusMatched = false;
  if (status && typeof status === "string") {
    const s = status.trim();
    for (const [k, v] of Object.entries(STATUS_ENUM_VALUES)) {
      if (s.toLowerCase().includes(k.toLowerCase())) {
        status = v;
        statusMatched = true;
        break;
      }
    }
  }
  if (!statusMatched) {
    for (const origKey of originalKeys) {
      const val = raw[origKey];
      if (typeof val === "string") {
        for (const [k, v] of Object.entries(STATUS_ENUM_VALUES)) {
          if (val.includes(k)) {
            status = v;
            if (!parsedData.status) {
              fieldMappings.push({
                originalName: origKey,
                canonicalName: "status",
                confidence: 0.6,
                matchRound: "fallback",
              });
            }
            statusMatched = true;
            break;
          }
        }
        if (statusMatched) break;
      }
    }
  }
  if (!statusMatched) {
    status = "pending";
  }

  parsedData.source = source;
  parsedData.status = status;

  return { parsedData, fieldMappings, source, status };
}

export function buildMinutesFromRaw(raw: Record<string, any>, rawContent?: string): MeetingMinutes {
  const now = new Date().toISOString();
  const { parsedData, fieldMappings, source, status } = parseRawMinutes(raw);
  return {
    id: `MIN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    source,
    status,
    rawContent: rawContent ?? JSON.stringify(raw, null, 2),
    rawData: { ...raw },
    parsedData,
    fieldMappings,
    title: parsedData.title,
    meetingDate: parsedData.meetingDate,
    participant: parsedData.participant,
    createdAt: now,
    updatedAt: now,
  };
}
