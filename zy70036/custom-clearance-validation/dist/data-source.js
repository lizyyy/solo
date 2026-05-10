"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourceOptions = void 0;
const typeorm_1 = require("typeorm");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
exports.dataSourceOptions = {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'custom_clearance',
    entities: ['dist/entities/**/*.entity.js'],
    migrations: ['dist/migrations/**/*.js'],
    synchronize: process.env.DB_SYNC === 'true',
    logging: process.env.NODE_ENV === 'development',
};
exports.default = new typeorm_1.DataSource(exports.dataSourceOptions);
//# sourceMappingURL=data-source.js.map