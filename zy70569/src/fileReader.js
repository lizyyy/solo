import fs from "fs/promises";
import { parse } from "csv-parse/sync";
export async function readSamples(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  if (filePath.endsWith(".json")) return JSON.parse(content);
  if (filePath.endsWith(".csv")) return parseCSV(content);
  throw new Error("不支持的文件格式，请使用CSV或JSON");
}
function parseCSV(content) {
  const records = parse(content, { columns: true, skip_empty_lines: false, relax_column_count: true });
  return records.map((r, i) => ({ lineNumber: i + 2, url: r.url || "", headers: parseJSONField(r.headers, {}), cookies: r.cookies || "", description: r.description || "", raw: JSON.stringify(r) }));
}
function parseJSONField(f, def) { if (!f) return def; try { return JSON.parse(f); } catch { return def; } }
export async function readRules(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}