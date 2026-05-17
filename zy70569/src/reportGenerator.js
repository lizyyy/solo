import fs from "fs/promises";
import chalk from "chalk";

export function printSummary(results) {
  console.log();
  console.log(chalk.bold.blue("=== CDN Cache Report ==="));
  console.log(chalk.cyan("Total: " + results.total));
  console.log(chalk.green("Valid: " + results.valid));
  if (results.invalid > 0) console.log(chalk.red("Invalid: " + results.invalid));
  console.log(chalk.magenta("Unique Keys: " + results.uniqueKeys));
}

export async function exportJSON(results, outputPath) {
  await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
  console.log(chalk.green("JSON exported"));
}

export async function exportHTML(results, outputPath) {
  let html = "<h1>CDN Cache Report</h1>";
  html += "<p>Total: " + results.total + "</p>";
  await fs.writeFile(outputPath, html);
  console.log(chalk.green("HTML exported"));
}
