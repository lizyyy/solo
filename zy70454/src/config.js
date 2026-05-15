const path = 'data/deprecation.db';
const cacheTTL = 3600000;
const batchSize = 100;

export default {
  db: { path },
  cache: { ttl: cacheTTL },
  processing: { batchSize },
  paths: {
    data: 'data',
    exports: 'exports',
    reports: 'reports'
  }
};
