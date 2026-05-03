import { GuestParser } from './csv-parser.js';
import { TableParser } from './json-parser.js';

export { GuestParser, TableParser };

export async function parseGuests(filePath) {
  const parser = new GuestParser();
  return parser.parseFile(filePath);
}

export async function parseTables(filePath) {
  const parser = new TableParser();
  return parser.parseFile(filePath);
}

export async function parseData(guestsPath, tablesPath) {
  const [guestsResult, tablesResult] = await Promise.all([
    parseGuests(guestsPath),
    parseTables(tablesPath)
  ]);

  const allErrors = [...guestsResult.errors, ...tablesResult.errors];

  return {
    guests: guestsResult.guests,
    tables: tablesResult.tables,
    errors: allErrors
  };
}
