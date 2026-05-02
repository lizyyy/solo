const config = require('../config/config');
const ColdBoxTimeline = require('../models/coldBoxTimeline');
const BloodBag = require('../models/bloodBag');
const SampleTube = require('../models/sampleTube');
const BagTubeMatch = require('../models/bagTubeMatch');

const RulesEngine = {
  validateSampleTubeMatch: async (bloodBagId, sampleTubeId) => {
    const bloodBag = await BloodBag.findById(bloodBagId);
    const sampleTube = await SampleTube.findById(sampleTubeId);

    if (!bloodBag || !sampleTube) {
      return {
        valid: false,
        error: '血袋或样本管不存在',
        rule: 'sample_tube_existence'
      };
    }

    if (bloodBag.donor_id !== sampleTube.donor_id) {
      return {
        valid: false,
        error: '血袋和样本管不属于同一献血者',
        rule: 'donor_mismatch',
        bloodBagDonor: bloodBag.donor_id,
        sampleTubeDonor: sampleTube.donor_id
      };
    }

    const existingMatches = await BagTubeMatch.findByDonorCode(bloodBag.donor_code);
    const existingMatch = existingMatches.find(
      m => m.blood_bag_id === bloodBagId && m.sample_tube_id === sampleTubeId
    );

    if (existingMatch) {
      return {
        valid: false,
        error: '该血袋和样本管已配对',
        rule: 'duplicate_match'
      };
    }

    return {
      valid: true,
      message: '配对验证通过'
    };
  },

  checkSampleTubeMissing: async (donorCode) => {
    const bloodBags = await BloodBag.getByDonorCode(donorCode);
    const sampleTubes = await SampleTube.getByDonorCode(donorCode);
    const matches = await BagTubeMatch.findByDonorCode(donorCode);

    const matchedBagIds = new Set(matches.map(m => m.blood_bag_id));
    const matchedTubeIds = new Set(matches.map(m => m.sample_tube_id));

    const unmatchedBags = bloodBags.filter(bag => !matchedBagIds.has(bag.id));
    const unmatchedTubes = sampleTubes.filter(tube => !matchedTubeIds.has(tube.id));

    if (unmatchedBags.length > 0 || unmatchedTubes.length > 0) {
      return {
        valid: false,
        error: '存在未配对的血袋或样本管',
        rule: 'sample_tube_missing',
        unmatchedBags: unmatchedBags.map(b => ({ id: b.id, code: b.bag_code })),
        unmatchedTubes: unmatchedTubes.map(t => ({ id: t.id, code: t.tube_code }))
      };
    }

    return {
      valid: true,
      message: '所有血袋和样本管均已配对'
    };
  },

  checkColdBoxCrossContamination: async (bloodBagCode, targetBoxId) => {
    const timeline = await ColdBoxTimeline.getByBloodBagCode(bloodBagCode);

    if (timeline.length === 0) {
      return {
        valid: true,
        message: '该血袋没有冷箱记录',
        rule: 'no_cold_box_history'
      };
    }

    const currentBoxEntries = timeline.filter(t => t.box_id === targetBoxId);
    const otherBoxEntries = timeline.filter(t => t.box_id !== targetBoxId);

    if (otherBoxEntries.length > 0) {
      const uniqueOtherBoxes = [...new Set(otherBoxEntries.map(t => t.box_code))];

      return {
        valid: false,
        error: `血袋 ${bloodBagCode} 存在跨箱记录`,
        rule: 'cross_box_contamination',
        currentBoxId: targetBoxId,
        otherBoxes: uniqueOtherBoxes,
        details: otherBoxEntries.map(t => ({
          box_code: t.box_code,
          event_type: t.event_type,
          event_time: t.event_time,
          temperature: t.temperature
        }))
      };
    }

    return {
      valid: true,
      message: '血袋冷箱记录一致，无跨箱'
    };
  },

  checkTemperatureTimeout: async (boxId) => {
    const timeline = await ColdBoxTimeline.getByBoxId(boxId);

    if (timeline.length === 0) {
      return {
        valid: true,
        message: '该冷箱没有温度记录',
        rule: 'no_temperature_history'
      };
    }

    const maxTemp = config.MAX_COLD_BOX_TEMP;
    const maxDurationHours = config.MAX_COLD_BOX_DURATION_HOURS;

    let temperatureExceeds = [];
    let firstOverTempTime = null;
    let lastOverTempTime = null;
    let totalOverTempDuration = 0;

    for (let i = 0; i < timeline.length; i++) {
      const entry = timeline[i];
      if (entry.temperature !== null && entry.temperature > maxTemp) {
        temperatureExceeds.push({
          time: entry.event_time,
          temperature: entry.temperature,
          box_code: entry.box_code
        });

        if (!firstOverTempTime) {
          firstOverTempTime = new Date(entry.event_time);
        }
        lastOverTempTime = new Date(entry.event_time);
      }
    }

    if (firstOverTempTime && lastOverTempTime) {
      totalOverTempDuration = (lastOverTempTime - firstOverTempTime) / (1000 * 60 * 60);
    }

    if (temperatureExceeds.length > 0) {
      const isTimeout = totalOverTempDuration > maxDurationHours;

      return {
        valid: !isTimeout,
        error: isTimeout ? `温度超时时长超过 ${maxDurationHours} 小时` : `温度超过最大值 ${maxTemp}°C`,
        rule: isTimeout ? 'temperature_timeout' : 'temperature_exceed',
        maxTemp: maxTemp,
        maxDurationHours: maxDurationHours,
        temperatureExceeds: temperatureExceeds,
        totalOverTempDuration: totalOverTempDuration,
        firstOverTempTime: firstOverTempTime,
        lastOverTempTime: lastOverTempTime
      };
    }

    return {
      valid: true,
      message: '温度记录正常'
    };
  },

  validateHandoverItem: async (handoverItem) => {
    const { blood_bag_id, sample_tube_id, donor_code } = handoverItem;

    const results = [];

    if (blood_bag_id && sample_tube_id) {
      const matchResult = await this.validateSampleTubeMatch(blood_bag_id, sample_tube_id);
      results.push({
        type: 'sample_tube_match',
        ...matchResult
      });
    }

    if (donor_code) {
      const missingResult = await this.checkSampleTubeMissing(donor_code);
      results.push({
        type: 'sample_tube_missing',
        ...missingResult
      });
    }

    const allValid = results.every(r => r.valid);

    return {
      valid: allValid,
      results: results,
      message: allValid ? '交接项验证通过' : '存在验证失败项'
    };
  },

  validateCompleteHandover: async (handoverItems) => {
    const results = [];
    const donorCodes = new Set();

    for (const item of handoverItems) {
      const validation = await this.validateHandoverItem(item);
      results.push({
        item: item,
        validation: validation
      });

      if (item.donor_code) {
        donorCodes.add(item.donor_code);
      }
    }

    const allValid = results.every(r => r.validation.valid);

    return {
      valid: allValid,
      totalItems: handoverItems.length,
      validItems: results.filter(r => r.validation.valid).length,
      invalidItems: results.filter(r => !r.validation.valid).length,
      details: results,
      message: allValid ? '所有交接项验证通过' : '部分交接项验证失败'
    };
  }
};

module.exports = RulesEngine;
