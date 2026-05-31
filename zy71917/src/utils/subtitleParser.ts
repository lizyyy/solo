export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

export function formatVTTTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function parseTimestamp(ts: string): number {
  const cleaned = ts.trim().replace(",", ".");
  const match = cleaned.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return 0;
  const [, h, m, s, ms] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

export function parseSRT(text: string): Array<{ index: number; startTime: number; endTime: number; text: string }> {
  const results: Array<{ index: number; startTime: number; endTime: number; text: string }> = [];
  const blocks = text.trim().replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    const index = parseInt(lines[0], 10);
    if (isNaN(index)) continue;

    const timeMatch = lines[1].match(
      /^(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})$/
    );
    if (!timeMatch) continue;

    const startTime = parseTimestamp(timeMatch[1]);
    const endTime = parseTimestamp(timeMatch[2]);
    const text = lines.slice(2).join("\n");

    results.push({ index, startTime, endTime, text });
  }

  return results;
}

export function parseVTT(text: string): Array<{ index: number; startTime: number; endTime: number; text: string }> {
  const results: Array<{ index: number; startTime: number; endTime: number; text: string }> = [];
  let normalized = text.trim().replace(/\r\n/g, "\n");

  if (normalized.startsWith("WEBVTT")) {
    normalized = normalized.replace(/^WEBVTT[^\n]*\n\n?/, "");
  }

  const blocks = normalized.split(/\n\n+/);
  let autoIndex = 1;

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 1) continue;

    let startLine = 0;
    let index = autoIndex;

    if (lines.length >= 2 && !lines[0].includes("-->")) {
      const parsedIndex = parseInt(lines[0], 10);
      if (!isNaN(parsedIndex)) {
        index = parsedIndex;
        startLine = 1;
      }
    }

    const timeLine = lines[startLine] || "";
    const timeMatch = timeLine.match(
      /^(\d{2}:\d{2}:\d{2}[,\.]\d{3}|\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3}|\d{2}:\d{2}[,\.]\d{3})/
    );
    if (!timeMatch) continue;

    const startTime = parseTimestamp(
      timeMatch[1].includes(":") && timeMatch[1].split(":").length === 2
        ? `00:${timeMatch[1]}`
        : timeMatch[1]
    );
    const endTime = parseTimestamp(
      timeMatch[2].includes(":") && timeMatch[2].split(":").length === 2
        ? `00:${timeMatch[2]}`
        : timeMatch[2]
    );

    const captionText = lines.slice(startLine + 1).join("\n");

    results.push({ index, startTime, endTime, text: captionText });
    autoIndex = index + 1;
  }

  return results;
}

export function generateSRT(entries: Array<{ startTime: number; endTime: number; text: string }>): string {
  return entries
    .map((entry, i) => {
      const index = i + 1;
      const start = formatTimestamp(entry.startTime);
      const end = formatTimestamp(entry.endTime);
      return `${index}\n${start} --> ${end}\n${entry.text}`;
    })
    .join("\n\n");
}

export function generateVTT(entries: Array<{ startTime: number; endTime: number; text: string }>): string {
  const body = entries
    .map((entry) => {
      const start = formatVTTTimestamp(entry.startTime);
      const end = formatVTTTimestamp(entry.endTime);
      return `${start} --> ${end}\n${entry.text}`;
    })
    .join("\n\n");

  return `WEBVTT\n\n${body}`;
}
