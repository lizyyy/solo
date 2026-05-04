const { parseAppleHealthXML } = require('../xmlParser');

describe('XML Parser', () => {
  describe('parseAppleHealthXML', () => {
    test('should parse valid XML with step count records', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="zh_CN">
  <ExportDate value="2026-05-04 10:00:00 +0800"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" creationDate="2026-04-01 08:00:00 +0800" startDate="2026-04-01 08:00:00 +0800" endDate="2026-04-01 09:00:00 +0800" value="1000"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" creationDate="2026-04-01 09:00:00 +0800" startDate="2026-04-01 09:00:00 +0800" endDate="2026-04-01 10:00:00 +0800" value="500"/>
</HealthData>`;
      
      const result = await parseAppleHealthXML(xml);
      expect(result).toBeDefined();
      expect(result.records).toBeDefined();
      expect(result.records.length).toBeGreaterThan(0);
    });

    test('should handle records with invalid values gracefully', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="zh_CN">
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" creationDate="2026-04-01 08:00:00 +0800" startDate="2026-04-01 08:00:00 +0800" endDate="2026-04-01 09:00:00 +0800" value="abc"/>
  <Record type="HKQuantityTypeIdentifierStepCount" sourceName="Apple Watch" unit="count" creationDate="2026-04-01 09:00:00 +0800" startDate="2026-04-01 09:00:00 +0800" endDate="2026-04-01 10:00:00 +0800" value="500"/>
</HealthData>`;
      
      const result = await parseAppleHealthXML(xml);
      expect(result).toBeDefined();
      expect(result.stats.skippedRecords).toBeGreaterThan(0);
    });

    test('should parse workout records', async () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="zh_CN">
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="1800" durationUnit="min" totalDistance="5.2" totalDistanceUnit="km" totalEnergyBurned="420" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch" creationDate="2026-04-05 07:30:00 +0800" startDate="2026-04-05 07:00:00 +0800" endDate="2026-04-05 07:30:00 +0800">
    <MetadataEntry key="HKWorkoutMetadataKeyAverageHeartRate" value="145"/>
  </Workout>
</HealthData>`;
      
      const result = await parseAppleHealthXML(xml);
      expect(result).toBeDefined();
      expect(result.workouts).toBeDefined();
      expect(result.workouts.length).toBe(1);
    });

    test('should return empty result for invalid XML', async () => {
      const invalidXml = 'This is not valid XML';
      const result = await parseAppleHealthXML(invalidXml);
      expect(result).toBeDefined();
      expect(result.records.length).toBe(0);
      expect(result.stats.parseErrors).toBeGreaterThan(0);
    });
  });
});
