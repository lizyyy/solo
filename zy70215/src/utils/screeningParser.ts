import type { Screening } from '../types';
import { generateId } from './storage';

interface ParsedScreening {
  hallNumber: string;
  movieName: string;
  startTime: string;
  endTime: string;
  date: string;
  audienceCount: number;
}

export function parseScreeningsText(text: string): ParsedScreening[] {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const results: ParsedScreening[] = [];

  for (const line of lines) {
    const parts = line.split(/[,\t|;]/).map(p => p.trim());

    if (parts.length < 4) continue;

    let hallNumber = '';
    let movieName = '';
    let startTime = '';
    let endTime = '';
    let date = new Date().toISOString().slice(0, 10);
    let audienceCount = 0;

    for (const part of parts) {
      const timeMatch = part.match(/(\d{1,2}[:：]\d{2})\s*[-~至到]\s*(\d{1,2}[:：]\d{2})/);
      if (timeMatch) {
        startTime = timeMatch[1].replace('：', ':');
        endTime = timeMatch[2].replace('：', ':');
        continue;
      }

      const hallMatch = part.match(/(\d+)\s*号?厅?/);
      if (hallMatch && !hallNumber) {
        hallNumber = hallMatch[1];
        continue;
      }

      const countMatch = part.match(/(\d+)\s*人?/);
      if (countMatch && !isNaN(parseInt(countMatch[1])) && parseInt(countMatch[1]) < 1000) {
        audienceCount = parseInt(countMatch[1]);
        continue;
      }

      const dateMatch = part.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (dateMatch) {
        date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
        continue;
      }

      if (!movieName && part.length >= 2 && !/^\d+$/.test(part)) {
        movieName = part;
      }
    }

    if (hallNumber && movieName && startTime && endTime) {
      results.push({ hallNumber, movieName, startTime, endTime, date, audienceCount });
    }
  }

  return results;
}

export function createScreening(p: ParsedScreening): Screening {
  return {
    id: generateId(),
    hallNumber: p.hallNumber,
    movieName: p.movieName,
    startTime: p.startTime,
    endTime: p.endTime,
    date: p.date,
    audienceCount: p.audienceCount,
  };
}

export function generateSampleScreenings(): Screening[] {
  const today = new Date().toISOString().slice(0, 10);
  const sample: ParsedScreening[] = [
    { hallNumber: '1', movieName: '流浪地球3', startTime: '09:00', endTime: '11:15', date: today, audienceCount: 120 },
    { hallNumber: '1', movieName: '封神第二部', startTime: '11:45', endTime: '14:00', date: today, audienceCount: 95 },
    { hallNumber: '1', movieName: '哪吒2', startTime: '14:30', endTime: '16:45', date: today, audienceCount: 150 },
    { hallNumber: '2', movieName: '封神第二部', startTime: '09:30', endTime: '11:45', date: today, audienceCount: 88 },
    { hallNumber: '2', movieName: '流浪地球3', startTime: '12:15', endTime: '14:30', date: today, audienceCount: 110 },
    { hallNumber: '2', movieName: '哈利波特重置版', startTime: '15:00', endTime: '17:15', date: today, audienceCount: 75 },
    { hallNumber: '3', movieName: '哪吒2', startTime: '10:00', endTime: '12:15', date: today, audienceCount: 140 },
    { hallNumber: '3', movieName: '哈利波特重置版', startTime: '12:45', endTime: '15:00', date: today, audienceCount: 60 },
    { hallNumber: '3', movieName: '流浪地球3', startTime: '15:30', endTime: '17:45', date: today, audienceCount: 105 },
  ];
  return sample.map(createScreening);
}
