const moment = require('moment');

class Showtime {
  constructor(data) {
    this.id = data.id || data.showtime_id || null;
    this.cinemaId = data.cinema_id || data.cinemaId || null;
    this.cinemaName = data.cinema_name || data.cinemaName || null;
    this.filmId = data.film_id || data.filmId || null;
    this.filmName = data.film_name || data.filmName || null;
    this.screenId = data.screen_id || data.screenId || null;
    this.screenName = data.screen_name || data.screenName || null;
    this.showDate = data.show_date || data.showDate || null;
    this.startTime = data.start_time || data.startTime || null;
    this.endTime = data.end_time || data.endTime || null;
    this.totalSeats = parseInt(data.total_seats || data.totalSeats || 0);
    this.soldSeats = parseInt(data.sold_seats || data.soldSeats || 0);
    this.ticketPrice = parseFloat(data.ticket_price || data.ticketPrice || 0);
    this.serviceFee = parseFloat(data.service_fee || data.serviceFee || 0);
    this.refundedCount = parseInt(data.refunded_count || data.refundedCount || 0);
    this.batchId = data.batchId || null;
    this.sourceFile = data.sourceFile || null;
    this.lineNumber = data.lineNumber || null;
  }

  getShowDateTime() {
    if (!this.showDate || !this.startTime) return null;
    return moment(`${this.showDate} ${this.startTime}`, 'YYYY-MM-DD HH:mm');
  }

  getEndDateTime() {
    if (!this.showDate || !this.endTime) return null;
    const endMoment = moment(`${this.showDate} ${this.endTime}`, 'YYYY-MM-DD HH:mm');
    const startMoment = this.getShowDateTime();
    if (startMoment && endMoment.isBefore(startMoment)) {
      endMoment.add(1, 'day');
    }
    return endMoment;
  }

  isCrossDay() {
    const start = this.getShowDateTime();
    const end = this.getEndDateTime();
    if (!start || !end) return false;
    return !start.isSame(end, 'day');
  }

  getGrossBoxOffice() {
    return (this.soldSeats - this.refundedCount) * this.ticketPrice;
  }

  getNetBoxOffice() {
    return this.getGrossBoxOffice() - (this.refundedCount * this.ticketPrice * 0.3);
  }

  validate() {
    const errors = [];
    if (!this.cinemaId) errors.push('影院ID不能为空');
    if (!this.filmId) errors.push('影片ID不能为空');
    if (!this.showDate) errors.push('放映日期不能为空');
    if (!this.startTime) errors.push('开场时间不能为空');
    if (this.totalSeats <= 0) errors.push('总座位数必须大于0');
    if (this.soldSeats < 0) errors.push('已售座位数不能为负数');
    if (this.soldSeats > this.totalSeats) errors.push('已售座位数不能超过总座位数');
    if (this.ticketPrice <= 0) errors.push('票价必须大于0');
    if (this.refundedCount < 0) errors.push('退票数量不能为负数');
    if (this.refundedCount > this.soldSeats) errors.push('退票数量不能超过已售座位数');
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      cinemaId: this.cinemaId,
      cinemaName: this.cinemaName,
      filmId: this.filmId,
      filmName: this.filmName,
      screenId: this.screenId,
      screenName: this.screenName,
      showDate: this.showDate,
      startTime: this.startTime,
      endTime: this.endTime,
      totalSeats: this.totalSeats,
      soldSeats: this.soldSeats,
      ticketPrice: this.ticketPrice,
      serviceFee: this.serviceFee,
      refundedCount: this.refundedCount,
      isCrossDay: this.isCrossDay(),
      grossBoxOffice: this.getGrossBoxOffice(),
      netBoxOffice: this.getNetBoxOffice(),
      batchId: this.batchId,
      sourceFile: this.sourceFile,
      lineNumber: this.lineNumber
    };
  }
}

module.exports = Showtime;
