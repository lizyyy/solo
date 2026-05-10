const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../db');
const { Conversion, ShortLink, DeviceFingerprint, Task } = require('../models');
const { attributeConversion } = require('../services/attributionService');
const { getClientIP } = require('../services/deviceFingerprintService');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

class ConversionController {
  async createConversion(req, res) {
    try {
      const {
        conversionType,
        conversionValue = 0,
        externalOrderId,
        externalUserId,
        shortCode,
        deviceFingerprint,
        metadata = {},
      } = req.body;
      
      if (!conversionType) {
        return res.status(400).json({
          success: false,
          error: 'conversion_type_required',
          message: 'conversionType is required',
        });
      }
      
      if (!shortCode && !externalOrderId) {
        return res.status(400).json({
          success: false,
          error: 'identifier_required',
          message: 'Either shortCode or externalOrderId is required',
        });
      }
      
      const ipAddress = getClientIP(req);
      
      const result = await withRetry(
        () => this._processConversion({
          conversionType,
          conversionValue,
          externalOrderId,
          externalUserId,
          shortCode,
          deviceFingerprint,
          ipAddress,
          metadata,
        }),
        { maxAttempts: 3 },
        { externalOrderId, shortCode, ipAddress }
      );
      
      if (result.success) {
        return res.json({
          success: true,
          data: result.result,
        });
      }
      
      return res.status(500).json({
        success: false,
        error: 'conversion_failed',
        message: result.error?.message || 'Failed to process conversion',
      });
    } catch (error) {
      logger.error('Error creating conversion', {
        error: error.message,
        stack: error.stack,
      });
      
      return res.status(500).json({
        success: false,
        error: 'internal_error',
        message: error.message,
      });
    }
  }

  async _processConversion(data) {
    return sequelize.transaction(async (t) => {
      let shortLinkId = null;
      
      if (data.shortCode) {
        const { ShortLink } = require('../models');
        const shortLink = await ShortLink.findOne({
          where: { shortCode: data.shortCode, isActive: true },
          transaction: t,
        });
        shortLinkId = shortLink?.id;
      }
      
      let deviceFingerprintId = null;
      
      if (data.deviceFingerprint) {
        const { DeviceFingerprint } = require('../models');
        const fp = await DeviceFingerprint.findOne({
          where: { fingerprint: data.deviceFingerprint },
          transaction: t,
        });
        deviceFingerprintId = fp?.id;
      }
      
      const [conversion, created] = await Conversion.findOrCreate({
        where: { externalOrderId: data.externalOrderId || uuidv4() },
        defaults: {
          id: uuidv4(),
          shortLinkId,
          deviceFingerprintId,
          conversionType: data.conversionType,
          conversionValue: data.conversionValue,
          externalUserId: data.externalUserId,
          ipAddress: data.ipAddress,
          processed: false,
          metadata: data.metadata,
        },
        transaction: t,
      });
      
      if (!created) {
        logger.warn('Duplicate conversion detected', {
          externalOrderId: data.externalOrderId,
          conversionId: conversion.id,
        });
        
        return {
          success: true,
          result: {
            conversion,
            isDuplicate: true,
            isAttributed: conversion.isAttributed,
          },
        };
      }
      
      const attributionResult = await attributeConversion(conversion, 'first_click', t);
      
      if (!attributionResult.success) {
        await Task.create({
          type: 'process_conversion',
          referenceId: conversion.id,
          payload: {
            conversionId: conversion.id,
            error: attributionResult.reason,
          },
          status: 'pending',
          priority: 10,
        }, { transaction: t });
      }
      
      logger.info('Conversion created', {
        conversionId: conversion.id,
        externalOrderId: data.externalOrderId,
        isAttributed: attributionResult.attributed,
      });
      
      return {
        success: true,
        result: {
          conversion,
          isDuplicate: false,
          isAttributed: attributionResult.attributed,
          attributedChannel: attributionResult.shortLink?.channel,
          fraudScore: 0,
        },
      };
    });
  }

  async getConversionStats(req, res) {
    try {
      const { shortCode, startDate, endDate } = req.query;
      const { Op } = require('sequelize');
      const { Conversion, ShortLink } = require('../models');
      
      let whereClause = { processed: true };
      
      if (shortCode) {
        const shortLink = await ShortLink.findOne({ where: { shortCode } });
        if (shortLink) {
          whereClause.shortLinkId = shortLink.id;
        }
      }
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          [Op.between]: [new Date(startDate), new Date(endDate)],
        };
      }
      
      const conversions = await Conversion.findAndCountAll({
        where: whereClause,
        include: [{
          model: ShortLink,
          as: 'shortLink',
          attributes: ['shortCode', 'channel', 'campaign'],
        }],
      });
      
      const totalValue = conversions.rows.reduce(
        (sum, c) => sum + parseFloat(c.conversionValue || 0),
        0
      );
      
      const attributedCount = conversions.rows.filter(c => c.isAttributed).length;
      
      const channelStats = conversions.rows
        .filter(c => c.isAttributed && c.shortLink)
        .reduce((acc, c) => {
          const channel = c.shortLink.channel;
          if (!acc[channel]) {
            acc[channel] = { count: 0, value: 0 };
          }
          acc[channel].count++;
          acc[channel].value += parseFloat(c.conversionValue || 0);
          return acc;
        }, {});
      
      return res.json({
        success: true,
        data: {
          total: conversions.count,
          totalValue,
          attributed: attributedCount,
          channelStats,
          conversions: conversions.rows.slice(0, 100),
        },
      });
    } catch (error) {
      logger.error('Error getting conversion stats', {
        error: error.message,
      });
      
      return res.status(500).json({
        success: false,
        error: 'internal_error',
        message: error.message,
      });
    }
  }
}

module.exports = new ConversionController();
