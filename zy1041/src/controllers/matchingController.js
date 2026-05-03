const Request = require('../models/Request');
const Trip = require('../models/Trip');
const MatchingEngine = require('../services/MatchingEngine');

class MatchingController {
  static async matchRequestToTrips(req, res) {
    try {
      const { request_id } = req.params;
      
      const request = await Request.findById(request_id);
      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '请求单不存在'
        });
      }

      const trips = await Trip.findAllActive();
      const result = MatchingEngine.findMatchingTrips(request, trips);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('撮合请求单错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async matchTripToRequests(req, res) {
    try {
      const { trip_id } = req.params;
      
      const trip = await Trip.findById(trip_id);
      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '行程不存在'
        });
      }

      const requests = await Request.findAllPending();
      const result = MatchingEngine.findMatchingRequests(trip, requests);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('撮合行程错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async calculateMatchScore(req, res) {
    try {
      const { request_id, trip_id } = req.query;

      if (!request_id || !trip_id) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必要参数: request_id 和 trip_id'
        });
      }

      const request = await Request.findById(request_id);
      const trip = await Trip.findById(trip_id);

      if (!request) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '请求单不存在'
        });
      }

      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '行程不存在'
        });
      }

      const result = MatchingEngine.calculateMatchScore(request, trip);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('计算匹配分数错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = MatchingController;
