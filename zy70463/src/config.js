module.exports = {
  server: {
    port: process.env.PORT || 3000
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/resource_reservation',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  reservation: {
    status: {
      PENDING: 'pending',
      APPROVED: 'approved',
      REJECTED: 'rejected',
      ACTIVE: 'active',
      RELEASED: 'released',
      EXPIRED: 'expired'
    }
  }
};
