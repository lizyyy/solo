"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeCarReturns = analyzeCarReturns;
exports.getCarDetail = getCarDetail;
exports.getResponsiblePersonStats = getResponsiblePersonStats;
const database_1 = require("../database");
async function analyzeCarReturns(minReturns = 2) {
    const db = await (0, database_1.getDatabase)();
    const vinDates = await db.all(`
    SELECT vin, plateNumber, inspectionDate as date, inspector as person, estimatedCost as amount, 'inspection' as type
    FROM inspections
    UNION ALL
    SELECT vin, plateNumber, quoteDate as date, technician as person, totalPrice as amount, 'repair_quote' as type
    FROM repair_quotes
    UNION ALL
    SELECT vin, plateNumber, photoDate as date, photographer as person, 0 as amount, 'photo_list' as type
    FROM photo_lists
    UNION ALL
    SELECT vin, plateNumber, shiftDate as date, worker as person, workHours * 50 as amount, 'shift_record' as type
    FROM shift_records
    UNION ALL
    SELECT vin, plateNumber, adjustDate as date, adjustedBy as person, adjustedPrice as amount, 'manual_price' as type
    FROM manual_prices
  `);
    const vinGroups = new Map();
    vinDates.forEach(record => {
        if (!vinGroups.has(record.vin)) {
            vinGroups.set(record.vin, []);
        }
        vinGroups.get(record.vin).push(record);
    });
    const results = [];
    vinGroups.forEach((records, vin) => {
        const uniqueDates = new Set(records.map(r => r.date).filter(d => d));
        const returnCount = uniqueDates.size;
        if (returnCount >= minReturns) {
            const sortedRecords = records
                .filter(r => r.date)
                .sort((a, b) => a.date.localeCompare(b.date));
            const plateNumber = records.find(r => r.plateNumber)?.plateNumber || '';
            const totalCost = sortedRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
            const responsiblePersons = [...new Set(sortedRecords.map(r => r.person).filter(p => p))];
            results.push({
                vin,
                plateNumber,
                returnCount,
                firstEntryDate: sortedRecords[0]?.date || '',
                lastReturnDate: sortedRecords[sortedRecords.length - 1]?.date || '',
                totalCost,
                totalRevenue: 0,
                profit: -totalCost,
                responsiblePersons,
                records: sortedRecords.map(r => ({
                    type: r.type,
                    date: r.date,
                    person: r.person,
                    amount: r.amount
                }))
            });
        }
    });
    return results.sort((a, b) => b.returnCount - a.returnCount);
}
async function getCarDetail(vin) {
    const db = await (0, database_1.getDatabase)();
    const inspections = await db.all('SELECT * FROM inspections WHERE vin = ? ORDER BY inspectionDate', [vin]);
    const repairQuotes = await db.all('SELECT * FROM repair_quotes WHERE vin = ? ORDER BY quoteDate', [vin]);
    const photoLists = await db.all('SELECT * FROM photo_lists WHERE vin = ? ORDER BY photoDate', [vin]);
    const shiftRecords = await db.all('SELECT * FROM shift_records WHERE vin = ? ORDER BY shiftDate', [vin]);
    const manualPrices = await db.all('SELECT * FROM manual_prices WHERE vin = ? ORDER BY adjustDate', [vin]);
    const dirtyRecords = await db.all(`
    SELECT dr.* FROM dirty_records dr
    WHERE dr.sourceId IN (
      SELECT id FROM inspections WHERE vin = ?
      UNION SELECT id FROM repair_quotes WHERE vin = ?
      UNION SELECT id FROM photo_lists WHERE vin = ?
      UNION SELECT id FROM shift_records WHERE vin = ?
      UNION SELECT id FROM manual_prices WHERE vin = ?
    )
  `, [vin, vin, vin, vin, vin]);
    const totalCost = [
        ...inspections.map((r) => r.estimatedCost || 0),
        ...repairQuotes.map((r) => r.totalPrice || 0),
        ...shiftRecords.map((r) => (r.workHours || 0) * 50),
        ...manualPrices.map((r) => r.adjustedPrice || 0)
    ].reduce((a, b) => a + b, 0);
    return {
        vin,
        plateNumber: inspections[0]?.plateNumber || repairQuotes[0]?.plateNumber || '',
        summary: {
            inspectionCount: inspections.length,
            repairCount: repairQuotes.length,
            photoCount: photoLists.length,
            shiftCount: shiftRecords.length,
            priceAdjustCount: manualPrices.length,
            dirtyCount: dirtyRecords.length,
            totalCost
        },
        inspections,
        repairQuotes,
        photoLists,
        shiftRecords,
        manualPrices,
        dirtyRecords
    };
}
async function getResponsiblePersonStats() {
    const returns = await analyzeCarReturns(1);
    const personMap = new Map();
    returns.forEach(car => {
        car.records.forEach(record => {
            if (record.person) {
                if (!personMap.has(record.person)) {
                    personMap.set(record.person, {
                        cars: new Set(),
                        returnCars: new Set(),
                        totalCost: 0
                    });
                }
                const data = personMap.get(record.person);
                data.cars.add(car.vin);
                if (car.returnCount >= 2) {
                    data.returnCars.add(car.vin);
                }
                data.totalCost += record.amount;
            }
        });
    });
    return Array.from(personMap.entries()).map(([person, data]) => ({
        person,
        carCount: data.cars.size,
        returnCarCount: data.returnCars.size,
        totalCost: data.totalCost
    })).sort((a, b) => b.returnCarCount - a.returnCarCount);
}
