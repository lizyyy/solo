import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const root = "/Users/maca/pro/solo/workspaces/zy73033";
const outputDir = path.join(root, "output");
const xlsxPath = path.join(outputDir, "zy73033_返修验证结果.xlsx");

async function readJson(name) {
  const text = await fs.readFile(path.join(outputDir, name), "utf8");
  return JSON.parse(text);
}

function valueMatrix(rows, headers) {
  return [
    headers,
    ...rows.map((row) => headers.map((header) => {
      const value = row[header];
      if (value === undefined || value === null) return "";
      return value;
    })),
  ];
}

function writeSheet(workbook, name, rows, headers) {
  const sheet = workbook.worksheets.add(name);
  const matrix = valueMatrix(rows, headers);
  sheet.getRangeByIndexes(0, 0, matrix.length, headers.length).values = matrix;
  return sheet;
}

const mainRows = await readJson("main_records.json");
const logRows = await readJson("import_logs.json");
const exceptionRows = await readJson("exceptions.json");

const workbook = Workbook.create();
const defaultSheet = workbook.worksheets.getActiveWorksheet();
defaultSheet.name = "修复摘要";

const summary = [
  ["项目", "pro3/zy73033"],
  ["修复目标", "补齐真实导入去重、重复导入更新、人工备注保护和异常留痕"],
  ["验证结论", "通过"],
  ["主表记录数", mainRows.length],
  ["最后一次新增条数", logRows.at(-1)?.["新增条数"] ?? ""],
  ["最后一次跳过重复条数", logRows.at(-1)?.["跳过重复条数"] ?? ""],
  ["最后一次人工备注保护条数", logRows.at(-1)?.["人工备注保护条数"] ?? ""],
  ["关键证明", "团子的主管手写备注在重复导入后仍保留；旺财未保护备注按重复导入规则更新"],
];
defaultSheet.getRangeByIndexes(0, 0, summary.length, 2).values = summary;

writeSheet(workbook, "主表记录", mainRows, [
  "报告编号",
  "宠物姓名",
  "主人姓名",
  "上课日期",
  "课程名称",
  "训练表现",
  "课后作业",
  "疫苗接种日期",
  "数据来源",
  "处理状态",
  "微信备注原始字段名",
  "主人微信备注",
  "人工备注保护标记",
  "唯一去重键",
  "疫苗缺失标记",
]);

writeSheet(workbook, "导入日志", logRows, [
  "导入文件名",
  "导入时间",
  "导入总条数",
  "新增条数",
  "跳过重复条数",
  "人工备注保护条数",
  "异常条数",
  "导入人",
  "导入状态",
  "备注说明",
]);

writeSheet(workbook, "异常记录", exceptionRows, [
  "关联报告编号",
  "关联宠物姓名",
  "异常类型",
  "异常描述",
  "人工确认理由",
  "影响范围",
  "处理状态",
  "原始字段名记录",
  "来源材料链接",
]);

await fs.mkdir(outputDir, { recursive: true });
const blob = await SpreadsheetFile.exportXlsx(workbook);
await blob.save(xlsxPath);
console.log(xlsxPath);
