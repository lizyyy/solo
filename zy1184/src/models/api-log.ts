export interface ApiLog {
  id: string;
  requestId: string;
  timestamp: Date;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  statusCode: number;
  duration: number;
  userId?: string;
  userAgent?: string;
  ip?: string;
  queryParams?: Record<string, any>;
  requestBody?: any;
  responseBody?: any;
  metadata?: Record<string, any>;
}

export interface ApiLogParseOptions {
  format?: 'json' | 'csv' | 'plain';
  timestampFormat?: string;
  requestIdField?: string;
  durationField?: string;
  durationUnit?: 'ms' | 's' | 'us';
}
