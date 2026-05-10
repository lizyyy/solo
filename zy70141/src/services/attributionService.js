const { Op } = require('sequelize');
const config = require('../config');
const { AccessLog, Conversion, ShortLink, AttributionReport } = require('../models');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');

function isValidClickForAttribution(accessLog) {
  if (!accessLog) return false;
  if (accessLog.isFraud) return false;
  if (accessLog.isBlacklisted) return false;
  if (accessLog.isBot) return false;
  return true;
}

async function findAttributableClick(conversion, transaction = null) {
  const attributionWindow = config.attribution.windowHours;
  const windowStart = new Date(conversion.createdAt.getTime() - attributionWindow * 60 * 60 * 1000);
  
  let whereClause = {
    createdAt: { [Op.between]: [windowStart, conversion.createdAt] },
    processed: true,
    isFraud: false,
    isBlacklisted: false,
    isBot: false,
  };
  
  if (conversion.shortLinkId) {
    whereClause.shortLinkId = conversion.shortLinkId;
  }
  
  if (conversion.deviceFingerprintId) {
    whereClause = {
      [Op.and]: [
        whereClause,
        {
          [Op.or]: [
            { deviceFingerprintId: conversion.deviceFingerprintId },
            { ipAddress: conversion.ipAddress },
          ],
        },
      ],
    };
  } else if (conversion.ipAddress) {
    whereClause.ipAddress = conversion.ipAddress;
  }
  
  const validClicks = await AccessLog.findAll({
    where: whereClause,
    include: [{
      model: ShortLink,
      as: 'shortLink',
      attributes: ['id', 'shortCode', 'channel', 'campaign', 'source', 'medium'],
    }],
    order: [['createdAt', 'ASC']],
    transaction,
  });
  
  if (validClicks.length === 0) {
    return null;
  }
  
  return {
    firstClick: validClicks[0],
    lastClick: validClicks[validClicks.length - 1],
    allClicks: validClicks,
  };
}

async function attributeConversion(conversion, attributionModel = 'first_click', transaction = null) {
  logger.info('Starting attribution for conversion', {
    conversionId: conversion.id,
    externalOrderId: conversion.externalOrderId,
    attributionModel,
  });
  
  if (conversion.isAttributed) {
    logger.warn('Conversion already attributed', { conversionId: conversion.id });
    return { success: false, reason: 'already_attributed', conversion };
  }
  
  const clickData = await findAttributableClick(conversion, transaction);
  
  if (!clickData) {
    logger.info('No attributable click found for conversion', {
      conversionId: conversion.id,
    });
    
    await conversion.update({
      processed: true,
      isAttributed: false,
      attributionModel,
    }, { transaction });
    
    return { 
      success: true, 
      attributed: false,
      reason: 'no_valid_click',
      conversion,
    };
  }
  
  let attributedClick;
  switch (attributionModel) {
    case 'last_click':
      attributedClick = clickData.lastClick;
      break;
    case 'first_click':
    default:
      attributedClick = clickData.firstClick;
      break;
  }
  
  const shortLink = attributedClick.shortLink;
  
  await conversion.update({
    accessLogId: attributedClick.id,
    shortLinkId: shortLink.id,
    channel: shortLink.channel,
    isAttributed: true,
    attributionModel,
    attributionWindowEnded: new Date(
      attributedClick.createdAt.getTime() + config.attribution.windowHours * 60 * 60 * 1000
    ),
    processed: true,
  }, { transaction });
  
  logger.info('Conversion attributed successfully', {
    conversionId: conversion.id,
    shortLinkId: shortLink.id,
    channel: shortLink.channel,
    accessLogId: attributedClick.id,
  });
  
  return {
    success: true,
    attributed: true,
    conversion,
    attributedClick,
    shortLink,
  };
}

async function processPendingConversions() {
  const pendingConversions = await Conversion.findAll({
    where: {
      processed: false,
      retryCount: { [Op.lt]: 3 },
    },
    limit: 100,
    order: [['createdAt', 'ASC']],
  });
  
  const results = [];
  
  for (const conversion of pendingConversions) {
    const result = await withRetry(
      async () => {
        const { sequelize } = require('../db');
        return sequelize.transaction(async (t) => {
          return attributeConversion(conversion, 'first_click', t);
        });
      },
      { maxAttempts: 3 },
      { conversionId: conversion.id }
    );
    
    if (!result.success) {
      await conversion.update({
        retryCount: conversion.retryCount + 1,
        processingError: result.error?.message,
      });
    }
    
    results.push({
      conversionId: conversion.id,
      success: result.success,
      ...result.result,
    });
  }
  
  return results;
}

async function generateAttributionReport(reportDate, shortLinkId) {
  const startOfDay = new Date(reportDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(reportDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  const [report, created] = await AttributionReport.findOrCreate({
    where: { reportDate, shortLinkId },
    defaults: {
      status: 'processing',
      retryCount: 0,
    },
  });
  
  try {
    const shortLink = await ShortLink.findByPk(shortLinkId);
    if (!shortLink) {
      throw new Error(`ShortLink not found: ${shortLinkId}`);
    }
    
    const accessLogs = await AccessLog.findAll({
      where: {
        shortLinkId,
        createdAt: { [Op.between]: [startOfDay, endOfDay] },
      },
    });
    
    const conversions = await Conversion.findAll({
      where: {
        shortLinkId,
        isAttributed: true,
        createdAt: { [Op.between]: [startOfDay, endOfDay] },
      },
    });
    
    const totalClicks = accessLogs.length;
    const fraudClicks = accessLogs.filter(l => l.isFraud).length;
    const blockedClicks = accessLogs.filter(l => l.isBlacklisted).length;
    const botClicks = accessLogs.filter(l => l.isBot).length;
    const validClicks = accessLogs.filter(l => !l.isFraud && !l.isBlacklisted && !l.isBot).length;
    
    const uniqueVisitors = new Set(
      validClicks 
        ? accessLogs.filter(l => !l.isFraud).map(l => l.deviceFingerprintId || l.ipAddress)
        : []
    ).size;
    
    const totalConversions = conversions.length;
    const conversionValue = conversions.reduce(
      (sum, c) => sum + parseFloat(c.conversionValue || 0),
      0
    );
    
    const conversionRate = validClicks > 0 ? totalConversions / validClicks : 0;
    const fraudRate = totalClicks > 0 ? fraudClicks / totalClicks : 0;
    
    await report.update({
      channel: shortLink.channel,
      campaign: shortLink.campaign,
      totalClicks,
      validClicks,
      fraudClicks,
      blockedClicks,
      botClicks,
      uniqueVisitors,
      conversions: totalConversions,
      conversionValue,
      conversionRate,
      fraudRate,
      status: 'completed',
      processedAt: new Date(),
    });
    
    logger.info('Attribution report generated', {
      reportId: report.id,
      reportDate,
      shortLinkId,
      totalClicks,
      validClicks,
      conversions: totalConversions,
    });
    
    return report;
  } catch (error) {
    await report.update({
      status: 'failed',
      processingError: error.message,
      retryCount: report.retryCount + 1,
    });
    
    logger.error('Failed to generate attribution report', {
      reportDate,
      shortLinkId,
      error: error.message,
    });
    
    throw error;
  }
}

module.exports = {
  isValidClickForAttribution,
  findAttributableClick,
  attributeConversion,
  processPendingConversions,
  generateAttributionReport,
};
