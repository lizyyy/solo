const { parseDailyNotesCSV } = require('../csvParser');

describe('CSV Parser', () => {
  describe('parseDailyNotesCSV', () => {
    test('should parse valid CSV with daily notes', async () => {
      const csv = `date,text,stay_up,alcohol,travel,sick,stress,coffee
2026-04-01,正常记录,0,0,0,0,0,1
2026-04-02,熬夜了,1,0,0,0,1,2
2026-04-03,出差,0,0,1,0,0,1`;
      
      const result = await parseDailyNotesCSV(csv);
      expect(result).toBeDefined();
      expect(result.notes).toBeDefined();
      expect(result.notes.length).toBe(3);
      
      const firstNote = result.notes[0];
      expect(firstNote.date).toBe('2026-04-01');
      expect(firstNote.text).toBe('正常记录');
      expect(firstNote.tags).toContain('coffee');
    });

    test('should handle missing columns gracefully', async () => {
      const csv = `date,text,stay_up
2026-04-01,测试,0`;
      
      const result = await parseDailyNotesCSV(csv);
      expect(result).toBeDefined();
      expect(result.notes.length).toBe(1);
    });

    test('should handle invalid dates', async () => {
      const csv = `date,text,stay_up,alcohol,travel,sick,stress,coffee
invalid-date,无效日期,1,0,0,0,0,1
2026-04-32,无效日期2,0,0,0,0,0,1
2026-04-01,有效日期,0,0,0,0,0,1`;
      
      const result = await parseDailyNotesCSV(csv);
      expect(result).toBeDefined();
      expect(result.stats.skippedRows).toBeGreaterThan(0);
    });

    test('should parse boolean tag columns correctly', async () => {
      const csv = `date,text,stay_up,alcohol,travel,sick,stress,coffee
2026-04-01,全部标签,1,1,1,1,1,1
2026-04-02,没有标签,0,0,0,0,0,0`;
      
      const result = await parseDailyNotesCSV(csv);
      expect(result.notes[0].tags).toEqual(
        expect.arrayContaining(['stay_up', 'alcohol', 'travel', 'sick', 'stress', 'coffee'])
      );
      expect(result.notes[1].tags).toHaveLength(0);
    });

    test('should handle parse errors', async () => {
      const invalidCsv = `invalid,csv,data
missing,commas
test,test`;
      
      const result = await parseDailyNotesCSV(invalidCsv);
      expect(result).toBeDefined();
    });
  });
});
