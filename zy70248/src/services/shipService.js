const store = require('../data/store');
const { createError, ErrorCodes } = require('../utils/errors');

class ShipService {
  createShip(data) {
    if (!data.name || !data.imoNumber) {
      throw createError(ErrorCodes.INVALID_PARAMETERS, { 
        required: ['name', 'imoNumber'],
        provided: Object.keys(data)
      });
    }

    return store.createShip({
      name: data.name,
      imoNumber: data.imoNumber,
      flag: data.flag || '未知',
      grossTonnage: data.grossTonnage || 0,
      operator: data.operator || '未知',
      vesselType: data.vesselType || '普通货船'
    });
  }

  getShip(id) {
    const ship = store.getShip(id);
    if (!ship) {
      throw createError(ErrorCodes.SHIP_NOT_FOUND, { shipId: id });
    }
    return ship;
  }

  getAllShips() {
    return store.getAllShips();
  }
}

module.exports = new ShipService();
