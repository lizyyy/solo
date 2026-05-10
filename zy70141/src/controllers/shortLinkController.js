const shortLinkAccessService = require('../services/shortLinkAccessService');
const logger = require('../utils/logger');

class ShortLinkController {
  async handleRedirect(req, res) {
    try {
      const { shortCode } = req.params;
      
      if (!shortCode) {
        return res.status(400).json({
          success: false,
          error: 'short_code_required',
          message: 'Short code is required',
        });
      }
      
      const result = await shortLinkAccessService.processAccess(shortCode, req);
      
      if (!result.success) {
        return res.status(result.statusCode || 404).json({
          success: false,
          error: result.error,
          message: 'Short link not found or expired',
        });
      }
      
      if (result.isFraud || result.isBlacklisted) {
        logger.warn('Fraudulent access detected', {
          shortCode,
          ipAddress: result.accessLog?.ipAddress,
          fraudScore: result.fraudScore,
          fraudReasons: result.fraudReasons,
        });
        
        return res.status(403).json({
          success: false,
          error: 'access_denied',
          message: 'Access denied',
          fraudScore: result.fraudScore,
        });
      }
      
      if (result.isBot) {
        logger.debug('Bot access detected', {
          shortCode,
          userAgent: req.headers['user-agent'],
        });
        
        return res.status(200).json({
          success: true,
          isBot: true,
          message: 'Bot detected',
        });
      }
      
      const shortLink = result.shortLink;
      
      return res.redirect(302, shortLink.originalUrl);
    } catch (error) {
      logger.error('Error handling short link redirect', {
        error: error.message,
        stack: error.stack,
        shortCode: req.params.shortCode,
      });
      
      return res.status(500).json({
        success: false,
        error: 'internal_error',
        message: 'An unexpected error occurred',
      });
    }
  }

  async getShortLinkStats(req, res) {
    try {
      const { shortCode } = req.params;
      const { ShortLink } = require('../models');
      
      const shortLink = await ShortLink.findOne({
        where: { shortCode },
        attributes: [
          'id', 'shortCode', 'channel', 'campaign', 'source',
          'totalClicks', 'validClicks', 'fraudClicks',
          'createdAt', 'expiresAt',
        ],
      });
      
      if (!shortLink) {
        return res.status(404).json({
          success: false,
          error: 'short_link_not_found',
        });
      }
      
      const { AccessLog } = require('../models');
      const { Op } = require('sequelize');
      
      const recentStats = await AccessLog.findAll({
        attributes: [
          'isFraud', 'isBot', 'isBlacklisted',
          'fraudReason',
        ],
        where: {
          shortLinkId: shortLink.id,
          createdAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      
      const stats = {
        ...shortLink.toJSON(),
        last24Hours: {
          total: recentStats.length,
          valid: recentStats.filter(l => !l.isFraud && !l.isBot && !l.isBlacklisted).length,
          fraud: recentStats.filter(l => l.isFraud).length,
          bot: recentStats.filter(l => l.isBot).length,
          blacklisted: recentStats.filter(l => l.isBlacklisted).length,
          fraudReasons: recentStats
            .filter(l => l.fraudReason)
            .reduce((acc, l) => {
              acc[l.fraudReason] = (acc[l.fraudReason] || 0) + 1;
              return acc;
            }, {}),
        },
      };
      
      return res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error getting short link stats', {
        error: error.message,
        shortCode: req.params.shortCode,
      });
      
      return res.status(500).json({
        success: false,
        error: 'internal_error',
        message: error.message,
      });
    }
  }
}

module.exports = new ShortLinkController();
