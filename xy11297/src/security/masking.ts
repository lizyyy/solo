import winston from 'winston';

const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return '';
  const phoneStr = String(phone);
  if (phoneStr.length >= 7) {
    return phoneStr.slice(0, 3) + '****' + phoneStr.slice(-4);
  }
  return phoneStr;
};

const maskName = (name: string | null | undefined): string => {
  if (!name) return '';
  const nameStr = String(name);
  if (nameStr.length <= 1) return nameStr;
  if (nameStr.length === 2) return nameStr[0] + '*';
  return nameStr[0] + '*'.repeat(nameStr.length - 2) + nameStr[nameStr.length - 1];
};

export interface MaskConfig {
  entity: string;
  fields: string[];
}

export const maskRoomState = (roomState: any): any => {
  if (!roomState) return roomState;
  return {
    ...roomState,
    guest_name: maskName(roomState.guest_name),
    guest_phone: maskPhone(roomState.guest_phone)
  };
};

export const maskCleaningRecord = (record: any): any => {
  if (!record) return record;
  return {
    ...record,
    cleaner_phone: maskPhone(record.cleaner_phone)
  };
};

export const maskComplaint = (complaint: any): any => {
  if (!complaint) return complaint;
  return {
    ...complaint,
    guest_name: maskName(complaint.guest_name),
    guest_phone: maskPhone(complaint.guest_phone)
  };
};

export const maskImportRecord = (record: any): any => {
  if (!record) return record;
  let masked = { ...record };
  try {
    const rawData = JSON.parse(record.raw_data);
    if (rawData.guestName || rawData.guest_name || rawData['客人姓名']) {
      rawData.guestName = maskName(rawData.guestName || rawData.guest_name || rawData['客人姓名']);
      rawData.guest_name = rawData.guestName;
    }
    if (rawData.guestPhone || rawData.guest_phone || rawData['客人电话']) {
      rawData.guestPhone = maskPhone(rawData.guestPhone || rawData.guest_phone || rawData['客人电话']);
      rawData.guest_phone = rawData.guestPhone;
    }
    if (rawData.cleanerPhone || rawData.cleaner_phone || rawData['保洁员电话']) {
      rawData.cleanerPhone = maskPhone(rawData.cleanerPhone || rawData.cleaner_phone || rawData['保洁员电话']);
      rawData.cleaner_phone = rawData.cleanerPhone;
    }
    masked.raw_data = JSON.stringify(rawData);
  } catch (e) {
  }
  return masked;
};

export const maskArray = <T>(data: T[], maskFn: (item: any) => any): T[] => {
  return data.map(item => maskFn(item));
};

const logMaskingFormat = winston.format((info) => {
  const phoneRegex = /1[3-9]\d{9}/g;
  if (typeof info.message === 'string') {
    info.message = info.message.replace(phoneRegex, (match) => maskPhone(match));
  }
  if (info.meta && typeof info.meta === 'object') {
    const metaStr = JSON.stringify(info.meta).replace(phoneRegex, (match) => maskPhone(match));
    info.meta = JSON.parse(metaStr);
  }
  return info;
});

export const createLogger = (level: string = 'info') => {
  return winston.createLogger({
    level,
    format: winston.format.combine(
      logMaskingFormat(),
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      })
    ]
  });
};
