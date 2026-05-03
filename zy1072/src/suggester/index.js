import { SeatingSuggester } from './suggester.js';

export { SeatingSuggester };

export async function generateSuggestions(guests, tables, validationResult) {
  const suggester = new SeatingSuggester();
  return suggester.generateSuggestions({
    guests,
    tables,
    validationResult
  });
}
