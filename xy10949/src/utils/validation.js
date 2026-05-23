export class ValidationError extends Error {
  constructor(message, { row, column, value, source } = {}) {
    super(message);
    this.name = 'ValidationError';
    this.row = row;
    this.column = column;
    this.value = value;
    this.source = source;
  }

  toJSON() {
    return {
      message: this.message,
      row: this.row,
      column: this.column,
      value: this.value,
      source: this.source
    };
  }
}

export function validateBooking(booking, rowIndex, source) {
  const errors = [];

  if (!booking.roomId && !booking.roomName) {
    errors.push(new ValidationError(
      '缺少房源标识',
      { row: rowIndex, column: 'room', value: booking.roomId || booking.roomName, source }
    ));
  }

  if (!booking.checkIn) {
    errors.push(new ValidationError(
      '缺少入住日期',
      { row: rowIndex, column: 'checkIn', value: booking.checkIn, source }
    ));
  }

  if (!booking.checkOut) {
    errors.push(new ValidationError(
      '缺少退房日期',
      { row: rowIndex, column: 'checkOut', value: booking.checkOut, source }
    ));
  }

  if (booking.checkIn && booking.checkOut && booking.checkIn >= booking.checkOut) {
    errors.push(new ValidationError(
      '入住日期必须早于退房日期',
      { row: rowIndex, column: 'checkIn/checkOut', value: `${booking.checkIn}-${booking.checkOut}`, source }
    ));
  }

  return errors;
}

export function validateFileExists(filePath, fs) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function validateOutputDir(dirPath, fs) {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    return true;
  } catch (e) {
    return false;
  }
}
