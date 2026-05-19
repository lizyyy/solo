import 'reflect-metadata';
import './config/env';
import app from './app';
import { AppDataSource } from './database/data-source';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    await AppDataSource.initialize();
    logger.info('Database connected successfully');

    app.listen(PORT, () => {
      logger.info(`QC System API server is running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

bootstrap();
