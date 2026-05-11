const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '自来水抢修阀门影响分析API',
      version: '1.0.0',
      description: '用于自来水管道抢修时的阀门影响范围分析API'
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: '本地开发服务器'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const specs = swaggerJsdoc(options);

module.exports = specs;