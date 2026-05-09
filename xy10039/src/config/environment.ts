export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-me' as string,
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./data/database.sqlite',
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtExpiresIn: '24h' as string | number
};
