module.exports = {
  port: 3000,
  database: {
    file: './data/hospital.db'
  },
  business: {
    confirmTimeoutMinutes: 30,
    cancelAdvanceMinutes: 60
  }
};
