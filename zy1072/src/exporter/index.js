import * as path from 'path';
import * as fs from 'fs/promises';
import { CsvExporter } from './csv-exporter.js';
import { MarkdownExporter } from './markdown-exporter.js';
import { HtmlExporter } from './html-exporter.js';

export { CsvExporter, MarkdownExporter, HtmlExporter };

export async function exportAll(guests, tables, outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const csvExporter = new CsvExporter();
  const mdExporter = new MarkdownExporter();
  const htmlExporter = new HtmlExporter();

  const seatingPlanPath = path.join(outputDir, 'seating-plan.csv');
  const kitchenNotesPath = path.join(outputDir, 'kitchen-notes.md');
  const printCardsPath = path.join(outputDir, 'print-cards.html');

  const [csvResult, mdResult, htmlResult] = await Promise.all([
    csvExporter.exportSeatingPlan(guests, tables, seatingPlanPath),
    mdExporter.exportKitchenNotes(guests, tables, kitchenNotesPath),
    htmlExporter.exportPrintCards(guests, tables, printCardsPath)
  ]);

  return {
    outputDir,
    files: [
      {
        name: 'seating-plan.csv',
        path: seatingPlanPath,
        description: '座位表汇总（CSV格式）',
        ...csvResult
      },
      {
        name: 'kitchen-notes.md',
        path: kitchenNotesPath,
        description: '厨房用餐注意事项（Markdown格式）',
        ...mdResult
      },
      {
        name: 'print-cards.html',
        path: printCardsPath,
        description: '打印用桌号卡和座位卡（HTML格式）',
        ...htmlResult
      }
    ],
    summary: {
      totalGuests: guests.length,
      totalTables: tables.length,
      seatedGuests: csvResult.seatedGuests,
      unseatedGuests: csvResult.unseatedGuests
    }
  };
}

export async function exportSeatingPlan(guests, tables, outputPath) {
  const exporter = new CsvExporter();
  return exporter.exportSeatingPlan(guests, tables, outputPath);
}

export async function exportKitchenNotes(guests, tables, outputPath) {
  const exporter = new MarkdownExporter();
  return exporter.exportKitchenNotes(guests, tables, outputPath);
}

export async function exportPrintCards(guests, tables, outputPath) {
  const exporter = new HtmlExporter();
  return exporter.exportPrintCards(guests, tables, outputPath);
}
