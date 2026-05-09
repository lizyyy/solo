import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';

export const generateBatchNo = () => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = uuidv4().substring(0, 6).toUpperCase();
  return `BATCH-${dateStr}-${random}`;
};

export const generateExceptionNo = () => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = uuidv4().substring(0, 8).toUpperCase();
  return `EXC-${dateStr}-${random}`;
};

export const generateOperationNo = () => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = uuidv4().substring(0, 8).toUpperCase();
  return `OP-${dateStr}-${random}`;
};

export const generateReportNo = () => {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = uuidv4().substring(0, 8).toUpperCase();
  return `RPT-${dateStr}-${random}`;
};
