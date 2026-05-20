const moment = require('moment');

class BoxOffice {
  constructor(data) {
    this.id = data.id || data.box_office_id || null;
    this.cinemaId = data.cinema_id || data.cinemaId || null;
    this.cinemaName = data.cinema_name || data.cinemaName || null;
    this.filmId = data.film_id || data.filmId || null;
    this.filmName = data.film_name || data.filmName || null;
    this.statDate = data.stat_date || data.statDate || null;
    this.totalBoxOffice = parseFloat(data.total_box_office || data.totalBoxOffice || 0);
    this.netBoxOffice = parseFloat(data.net_box_office || data.netBoxOffice || 0);
    this.serviceFee = parseFloat(data.service_fee || data.serviceFee || 0);
    this.ticketCount = parseInt(data.ticket_count || data.ticketCount || 0);
    this.refundCount = parseInt(data.refund_count || data.refundCount || 0);
    this.refundAmount = parseFloat(data.refund_amount || data.refundAmount || 0);
    this.batchId = data.batchId || null;
    this.sourceFile = data.sourceFile || null;
  }

  getStatMoment() {
    if (!this.statDate) return null;
    return moment(this.statDate, 'YYYY-MM-DD');
  }

  validate() {
    const errors = [];
    if (!this.cinemaId) errors.push('影院ID不能为空');
    if (!this.filmId) errors.push('影片ID不能为空');
    if (!this.statDate) errors.push('统计日期不能为空');
    if (this.totalBoxOffice < 0) errors.push('总票房不能为负数');
    if (this.ticketCount < 0) errors.push('售票数量不能为负数');
    if (this.refundCount < 0) errors.push('退票数量不能为负数');
    return errors;
  }

  toJSON() {
    return {
      id: this.id,
      cinemaId: this.cinemaId,
      cinemaName: this.cinemaName,
      filmId: this.filmId,
      filmName: this.filmName,
      statDate: this.statDate,
      totalBoxOffice: this.totalBoxOffice,
      netBoxOffice: this.netBoxOffice,
      serviceFee: this.serviceFee,
      ticketCount: this.ticketCount,
      refundCount: this.refundCount,
      refundAmount: this.refundAmount,
      batchId: this.batchId,
      sourceFile: this.sourceFile
    };
  }
}

module.exports = BoxOffice;
