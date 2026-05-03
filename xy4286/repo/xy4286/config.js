const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  storage: {
    baseDir: path.join(__dirname, 'data'),
    collections: {
      boxes: 'boxes.json',
      batches: 'batches.json',
      stations: 'stations.json',
      responsiblePersons: 'responsible_persons.json',
      temperatureLogs: 'temperature_logs.json',
      vehicleTrajectories: 'vehicle_trajectories.json',
      handoverForms: 'handover_forms.json',
      riskEvents: 'risk_events.json',
      auditEvents: 'audit_events.json',
      reviews: 'reviews.json'
    }
  },
  rules: {
    temperature: {
      min: 2,
      max: 8,
      maxOverTempDuration: 30,
      maxUnderTempDuration: 30
    },
    time: {
      maxDelayMinutes: 15
    }
  },
  upload: {
    dest: path.join(__dirname, 'uploads'),
    limits: {
      fileSize: 10 * 1024 * 1024
    }
  }
};
