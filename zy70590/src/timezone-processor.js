const { DateTime, Settings } = require('luxon');

Settings.defaultZone = 'UTC';

class TimezoneProcessor {
  constructor(options = {}) {
    this.targetTimezone = options.targetTimezone || 'UTC';
    this.dateFormats = options.dateFormats || [
      'ISO',
      'yyyy-MM-dd',
      'yyyy-MM-dd HH:mm:ss',
      'yyyy/MM/dd HH:mm:ss',
      'MM/dd/yyyy HH:mm:ss',
      'dd/MM/yyyy HH:mm:ss',
      'yyyy-MM-ddTHH:mm:ss',
      'yyyy-MM-ddTHH:mm:ssZ',
      'EEE MMM dd HH:mm:ss yyyy',
      'MMM dd, yyyy HH:mm:ss'
    ];
  }

  parseDateTime(value, sourceTimezone = 'UTC') {
    if (!value || value === '') {
      return {
        success: false,
        error: 'EMPTY_VALUE',
        message: '时间值为空'
      };
    }

    const strValue = String(value).trim();
    
    let dt = null;
    let matchedFormat = null;

    try {
      dt = DateTime.fromISO(strValue, { zone: sourceTimezone });
      if (dt.isValid) {
        matchedFormat = 'ISO';
      }
    } catch (e) {}

    if (!dt || !dt.isValid) {
      for (const format of this.dateFormats) {
        if (format === 'ISO') continue;
        try {
          dt = DateTime.fromFormat(strValue, format, { zone: sourceTimezone });
          if (dt.isValid) {
            matchedFormat = format;
            break;
          }
        } catch (e) {}
      }
    }

    if (!dt || !dt.isValid) {
      const timestamp = Number(strValue);
      if (!isNaN(timestamp) && isFinite(timestamp)) {
        if (timestamp > 1e12) {
          dt = DateTime.fromMillis(timestamp);
        } else if (timestamp > 1e9) {
          dt = DateTime.fromSeconds(timestamp);
        } else {
          dt = DateTime.fromMillis(timestamp * 1000);
        }
        if (dt.isValid) {
          dt = dt.setZone(sourceTimezone);
          matchedFormat = 'TIMESTAMP';
        }
      }
    }

    if (!dt || !dt.isValid) {
      return {
        success: false,
        error: 'PARSE_FAILED',
        message: `无法解析时间值: ${strValue}`,
        value: strValue
      };
    }

    return {
      success: true,
      datetime: dt,
      format: matchedFormat,
      sourceTimezone,
      originalValue: strValue
    };
  }

  convertToTimezone(dt, targetZone) {
    if (!dt || !dt.isValid) {
      return {
        success: false,
        error: 'INVALID_DATETIME',
        message: '无效的DateTime对象'
      };
    }

    const zone = targetZone || this.targetTimezone;
    const converted = dt.setZone(zone);

    if (!converted.isValid) {
      return {
        success: false,
        error: 'TIMEZONE_CONVERT_FAILED',
        message: `无法转换到时区: ${zone}`,
        targetZone: zone
      };
    }

    return {
      success: true,
      datetime: converted,
      timezone: zone,
      offset: converted.offset,
      offsetName: converted.toFormat('ZZZZ')
    };
  }

  checkDstTransition(dt) {
    if (!dt || !dt.isValid) {
      return null;
    }

    const zone = dt.zone;
    if (!zone || !zone.isValid) {
      return null;
    }

    const offset = dt.offset;
    const oneHourBefore = dt.minus({ hours: 1 });
    const oneHourAfter = dt.plus({ hours: 1 });

    const offsetBefore = oneHourBefore.offset;
    const offsetAfter = oneHourAfter.offset;

    const offsetChange = offsetAfter - offsetBefore;
    const isSpringForward = offsetChange > 0;
    const isFallBack = offsetChange < 0;
    const isDstTransitionPoint = isSpringForward || isFallBack;

    return {
      isDstTransitionPoint,
      offsetBefore,
      currentOffset: offset,
      offsetAfter,
      timezone: zone.name,
      offsetChange,
      isSpringForward,
      isFallBack
    };
  }

  normalize(value, sourceTimezone, targetTimezone) {
    const parseResult = this.parseDateTime(value, sourceTimezone);
    
    if (!parseResult.success) {
      return parseResult;
    }

    const dstCheck = this.checkDstTransition(parseResult.datetime);

    const convertResult = this.convertToTimezone(parseResult.datetime, targetTimezone);
    
    if (!convertResult.success) {
      return {
        ...convertResult,
        parsed: parseResult,
        dstInfo: dstCheck
      };
    }

    return {
      success: true,
      original: {
        value: parseResult.originalValue,
        timezone: sourceTimezone,
        format: parseResult.format
      },
      normalized: {
        datetime: convertResult.datetime,
        timezone: convertResult.timezone,
        offset: convertResult.offset,
        offsetName: convertResult.offsetName,
        isoString: convertResult.datetime.toISO()
      },
      dstInfo: dstCheck,
      utcTimestamp: convertResult.datetime.toUTC().toMillis()
    };
  }

  validateTimezone(zoneName) {
    if (!zoneName) return false;
    
    try {
      const dt = DateTime.now().setZone(zoneName);
      return dt.isValid && dt.zoneName === zoneName;
    } catch (e) {
      return false;
    }
  }
}

module.exports = TimezoneProcessor;