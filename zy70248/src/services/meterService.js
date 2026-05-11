const store = require('../data/store');
const { service: berthingService } = require('./berthingService');
const { createError, ErrorCodes } = require('../utils/errors');
const moment = require('moment');

const MAX_EXPECTED_READING_DIFF = 1000;

class MeterService {
  createReading(data) {
    if (!data.berthingId || data.kwh === undefined || data.kwh === null) {
      throw createError(ErrorCodes.INVALID_PARAMETERS, {
        required: ['berthingId', 'kwh'],
        provided: Object.keys(data)
      });
    }

    const berthing = berthingService.getBerthing(data.berthingId);
    
    if (!berthingService.isPowerActive(data.berthingId)) {
      throw createError(ErrorCodes.BERTHING_STATE_INVALID, {
        currentStatus: berthing.status,
        expected: 'USING_SHORE_POWER',
        message: '只有在使用岸电状态下才能记录读数'
      });
    }

    const kwh = Number(data.kwh);
    if (isNaN(kwh) || kwh < 0) {
      throw createError(ErrorCodes.METER_READING_INVALID, {
        kwh: data.kwh,
        message: '岸电读数必须是非负数字'
      });
    }

    const latestReading = store.getLatestMeterReading(data.berthingId);
    const readingTime = data.readingTime || moment().toISOString();

    if (latestReading) {
      if (moment(readingTime).isBefore(latestReading.readingTime)) {
        throw createError(ErrorCodes.READING_SEQUENCE_ERROR, {
          newReadingTime: readingTime,
          latestReadingTime: latestReading.readingTime
        });
      }

      if (kwh < latestReading.kwh) {
        throw createError(ErrorCodes.READING_DECREASED, {
          newReading: kwh,
          previousReading: latestReading.kwh
        });
      }
    }

    return store.createMeterReading({
      berthingId: data.berthingId,
      kwh,
      readingTime,
      meterId: data.meterId || null,
      source: data.source || 'MANUAL',
      notes: data.notes || null
    });
  }

  getReadingsByBerthing(berthingId) {
    berthingService.getBerthing(berthingId);
    return store.getMeterReadingsByBerthing(berthingId);
  }

  getLatestReading(berthingId) {
    berthingService.getBerthing(berthingId);
    return store.getLatestMeterReading(berthingId);
  }

  calculateUsage(berthingId) {
    const readings = this.getReadingsByBerthing(berthingId);
    if (readings.length < 2) {
      return {
        totalKwh: 0,
        firstReading: readings[0] || null,
        lastReading: readings[0] || null,
        readingCount: readings.length
      };
    }

    const firstReading = readings[0];
    const lastReading = readings[readings.length - 1];
    const totalKwh = lastReading.kwh - firstReading.kwh;

    return {
      totalKwh,
      firstReading,
      lastReading,
      readingCount: readings.length,
      averageKwhPerHour: this.calculateAverageUsage(firstReading, lastReading, totalKwh)
    };
  }

  calculateAverageUsage(firstReading, lastReading, totalKwh) {
    const durationHours = moment(lastReading.readingTime)
      .diff(moment(firstReading.readingTime), 'hours', true);
    
    if (durationHours <= 0) return 0;
    return totalKwh / durationHours;
  }

  validateReadingForReview(reading, berthing, latestReading) {
    const issues = [];
    const warnings = [];

    if (latestReading) {
      const diff = reading.kwh - latestReading.kwh;
      if (diff > MAX_EXPECTED_READING_DIFF) {
        issues.push({
          code: ErrorCodes.READING_EXCEEDS_EXPECTED,
          message: '读数增量超出预期范围',
          details: {
            currentDiff: diff,
            maxExpected: MAX_EXPECTED_READING_DIFF,
            previousReading: latestReading.kwh,
            newReading: reading.kwh
          }
        });
      }

      const timeDiffHours = moment(reading.readingTime)
        .diff(moment(latestReading.readingTime), 'hours', true);
      
      if (timeDiffHours > 0 && diff > 0) {
        const rate = diff / timeDiffHours;
        if (rate > 500) {
          warnings.push({
            message: '用电速率较高，建议复核',
            details: {
              rateKwhPerHour: rate,
              timeDiffHours,
              kwhDiff: diff
            }
          });
        }
      }
    }

    return { issues, warnings };
  }
}

module.exports = new MeterService();
