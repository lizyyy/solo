const { Op } = require('sequelize');
const MeterReading = require('../models/MeterReading');
const { dayjs } = require('../utils/dateUtils');

async function validateMeterReading(data) {
  const errors = [];
  
  if (data.roomId) {
    const previousReadings = await MeterReading.findAll({
      where: {
        houseId: data.houseId,
        roomId: data.roomId,
        readingType: data.readingType,
        readingDate: { [Op.lt]: data.readingDate }
      },
      order: [['readingDate', 'DESC']],
      limit: 1
    });

    if (previousReadings.length > 0) {
      const prevValue = parseFloat(previousReadings[0].readingValue);
      const newValue = parseFloat(data.readingValue);
      if (newValue < prevValue) {
        errors.push({
          type: 'reading_decrease',
          message: `读数异常：当前读数 ${newValue} 小于上次读数 ${prevValue}`
        });
      }
    }

    const sameDayReadings = await MeterReading.findAll({
      where: {
        houseId: data.houseId,
        roomId: data.roomId,
        readingType: data.readingType,
        readingDate: data.readingDate
      }
    });
    if (sameDayReadings.length > 0 && !data.isUpdate) {
      errors.push({
        type: 'duplicate_reading',
        message: '该日期已存在抄表记录'
      });
    }
  }
  
  return errors;
}

async function createMeterReading(data) {
  const errors = await validateMeterReading(data);
  const isAbnormal = errors.some(e => e.type === 'reading_decrease');
  const abnormalityReason = isAbnormal ? errors.map(e => e.message).join('; ') : null;
  
  const reading = await MeterReading.create({
    ...data,
    isAbnormal,
    abnormalityReason
  });
  
  return { reading, warnings: errors };
}

async function getReadingsForPeriod(houseId, roomId, readingType, startDate, endDate) {
  return await MeterReading.findAll({
    where: {
      houseId,
      roomId: roomId || null,
      readingType,
      readingDate: { [Op.between]: [startDate, endDate] }
    },
    order: [['readingDate', 'ASC']]
  });
}

async function getAdjacentReadings(houseId, roomId, readingType, targetDate) {
  const before = await MeterReading.findOne({
    where: {
      houseId,
      roomId: roomId || null,
      readingType,
      readingDate: { [Op.lte]: targetDate }
    },
    order: [['readingDate', 'DESC']]
  });
  
  const after = await MeterReading.findOne({
    where: {
      houseId,
      roomId: roomId || null,
      readingType,
      readingDate: { [Op.gte]: targetDate }
    },
    order: [['readingDate', 'ASC']]
  });
  
  return { before, after };
}

async function getAbnormalReadings(houseId) {
  return await MeterReading.findAll({
    where: { houseId, isAbnormal: true },
    order: [['readingDate', 'DESC']]
  });
}

module.exports = {
  createMeterReading,
  validateMeterReading,
  getReadingsForPeriod,
  getAdjacentReadings,
  getAbnormalReadings
};
