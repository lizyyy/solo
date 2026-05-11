const store = require('../data/store');
const shipService = require('./shipService');
const { createError, ErrorCodes } = require('../utils/errors');
const moment = require('moment');

const ContractTypes = {
  FLAT_RATE: 'FLAT_RATE',
  TIME_OF_USE: 'TIME_OF_USE',
  PEAK_OFFPEAK: 'PEAK_OFFPEAK'
};

class ContractService {
  createContract(data) {
    if (!data.shipId || !data.electricityPrice || !data.startDate) {
      throw createError(ErrorCodes.INVALID_PARAMETERS, {
        required: ['shipId', 'electricityPrice', 'startDate'],
        provided: Object.keys(data)
      });
    }

    shipService.getShip(data.shipId);

    const startDate = moment(data.startDate).startOf('day').toISOString();
    const endDate = data.endDate ? moment(data.endDate).endOf('day').toISOString() : null;

    return store.createContract({
      shipId: data.shipId,
      contractType: data.contractType || ContractTypes.FLAT_RATE,
      electricityPrice: Number(data.electricityPrice),
      currency: data.currency || 'CNY',
      startDate,
      endDate,
      peakPrice: data.peakPrice ? Number(data.peakPrice) : null,
      offPeakPrice: data.offPeakPrice ? Number(data.offPeakPrice) : null,
      peakHours: data.peakHours || [],
      minimumCharge: data.minimumCharge ? Number(data.minimumCharge) : null,
      contractNumber: data.contractNumber || `CT-${Date.now()}`,
      termsAndConditions: data.termsAndConditions || null
    });
  }

  getContract(id) {
    const contract = store.getContract(id);
    if (!contract) {
      throw createError(ErrorCodes.CONTRACT_NOT_FOUND, { contractId: id });
    }
    return contract;
  }

  getActiveContract(shipId, date = null) {
    const contract = store.getActiveContract(shipId, date);
    if (!contract) {
      throw createError(ErrorCodes.NO_ACTIVE_CONTRACT, { 
        shipId, 
        date: date || moment().toISOString() 
      });
    }
    return contract;
  }

  getContractsByShip(shipId) {
    shipService.getShip(shipId);
    return store.getContractsByShip(shipId);
  }

  getAllContracts() {
    return store.getAllContracts();
  }

  deactivateContract(id) {
    const contract = this.getContract(id);
    return store.updateContract ? 
      store.updateContract(id, { status: 'INACTIVE' }) :
      { ...contract, status: 'INACTIVE' };
  }

  getPriceForTime(contract, time) {
    const targetTime = moment(time);
    
    switch (contract.contractType) {
      case ContractTypes.FLAT_RATE:
        return contract.electricityPrice;
      
      case ContractTypes.PEAK_OFFPEAK:
        const hour = targetTime.hour();
        const isPeak = contract.peakHours && contract.peakHours.includes(hour);
        if (isPeak && contract.peakPrice) {
          return contract.peakPrice;
        }
        return contract.offPeakPrice || contract.electricityPrice;
      
      default:
        return contract.electricityPrice;
    }
  }
}

module.exports = {
  service: new ContractService(),
  ContractTypes
};
