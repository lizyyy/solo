const Trip = require('../models/Trip');
const AuditLog = require('../models/AuditLog');
const { AUDIT_ACTIONS } = require('../utils/constants');

class TripController {
  static async createTrip(req, res) {
    try {
      const {
        traveler_id,
        start_location,
        waypoints = [],
        destination,
        departure_time,
        arrival_time,
        available_capacity_weight = 10,
        available_capacity_volume = 20,
        forbidden_items = []
      } = req.body;

      if (!traveler_id || !start_location || !destination || !departure_time || !arrival_time) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: '缺少必填字段'
        });
      }

      const trip = await Trip.create({
        traveler_id,
        start_location,
        waypoints: Array.isArray(waypoints) ? waypoints : [],
        destination,
        departure_time,
        arrival_time,
        available_capacity_weight: parseFloat(available_capacity_weight) || 10,
        available_capacity_volume: parseFloat(available_capacity_volume) || 20,
        forbidden_items: Array.isArray(forbidden_items) ? forbidden_items : []
      });

      res.status(201).json({
        success: true,
        data: trip
      });
    } catch (error) {
      console.error('创建行程错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async getTrip(req, res) {
    try {
      const { id } = req.params;
      const trip = await Trip.findById(id);

      if (!trip) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: '行程不存在'
        });
      }

      res.json({
        success: true,
        data: trip
      });
    } catch (error) {
      console.error('获取行程错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }

  static async listTrips(req, res) {
    try {
      const { status, traveler_id } = req.query;
      let trips;

      if (status === 'active') {
        trips = await Trip.findAllActive();
      } else if (traveler_id) {
        trips = await Trip.findByTravelerId(traveler_id);
      } else {
        trips = await Trip.findAll();
      }

      res.json({
        success: true,
        data: trips
      });
    } catch (error) {
      console.error('列出行程错误:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
}

module.exports = TripController;
