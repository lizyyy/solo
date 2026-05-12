const moment = require('moment');
const { Contract, Installment, sequelize } = require('../models');

class ContractService {
  static async createContract(contractData) {
    const {
      contractNo,
      customerName,
      customerIdNo,
      principal,
      interestRate,
      term,
      startDate,
      maxForbearanceTimes,
    } = contractData;

    const monthlyRate = interestRate / 100 / 12;
    const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, term) / (Math.pow(1 + monthlyRate, term) - 1);
    const totalAmount = monthlyPayment * term;

    const transaction = await sequelize.transaction();

    try {
      const contract = await Contract.create({
        contractNo,
        customerName,
        customerIdNo,
        principal,
        interestRate,
        totalAmount,
        term,
        startDate,
        maxForbearanceTimes,
      }, { transaction });

      const installments = [];
      for (let i = 1; i <= term; i++) {
        const dueDate = moment(startDate).add(i, 'months').toDate();
        const principalAmount = monthlyPayment - (principal - (monthlyPayment * (i - 1))) * monthlyRate;
        const interestAmount = monthlyPayment - principalAmount;

        installments.push({
          contractId: contract.id,
          installmentNo: i,
          originalDueDate: dueDate,
          currentDueDate: dueDate,
          principalAmount: principalAmount.toFixed(2),
          interestAmount: interestAmount.toFixed(2),
          totalAmount: monthlyPayment.toFixed(2),
          remainingAmount: monthlyPayment.toFixed(2),
        });
      }

      await Installment.bulkCreate(installments, { transaction });
      await transaction.commit();

      return await this.getContractDetail(contract.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getContractDetail(contractId) {
    const contract = await Contract.findByPk(contractId, {
      include: [
        {
          model: Installment,
          as: 'installments',
          order: [['installmentNo', 'ASC']],
        },
      ],
    });

    if (!contract) {
      throw new Error('合同不存在');
    }

    return contract;
  }

  static async getContractByNo(contractNo) {
    const contract = await Contract.findOne({
      where: { contractNo },
      include: [
        {
          model: Installment,
          as: 'installments',
          order: [['installmentNo', 'ASC']],
        },
      ],
    });

    if (!contract) {
      throw new Error('合同不存在');
    }

    return contract;
  }

  static async listContracts(filters = {}) {
    return await Contract.findAll({
      where: filters,
      order: [['createdAt', 'DESC']],
    });
  }

  static async calculateForbearanceEligibility(contractId, installmentId) {
    const contract = await this.getContractDetail(contractId);
    const installment = contract.installments.find(i => i.id === installmentId);

    if (!installment) {
      throw new Error('账期不存在');
    }

    const result = {
      eligible: true,
      reasons: [],
      maxDays: 30,
      remainingForbearanceTimes: contract.maxForbearanceTimes - contract.usedForbearanceTimes,
    };

    if (contract.usedForbearanceTimes >= contract.maxForbearanceTimes) {
      result.eligible = false;
      result.reasons.push(`已超过最大宽限次数 (${contract.maxForbearanceTimes}次)`);
    }

    if (installment.status === 'paid') {
      result.eligible = false;
      result.reasons.push('该账期已结清');
    }

    if (installment.isForborne && installment.forbearanceCount >= 2) {
      result.eligible = false;
      result.reasons.push('该账期已宽限2次，不可再宽限');
    }

    const today = moment();
    const daysOverdue = today.diff(moment(installment.currentDueDate), 'days');
    if (daysOverdue > 90) {
      result.eligible = false;
      result.reasons.push('逾期超过90天，不可宽限');
    }

    if (contract.isInCollection) {
      if (contract.collectionFreezeUntil && moment(contract.collectionFreezeUntil).isAfter(today)) {
        result.reasons.push('催收已冻结，宽限需特别审批');
        result.requiresSpecialApproval = true;
      } else {
        result.reasons.push('合同在催收中，宽限需特别审批');
        result.requiresSpecialApproval = true;
      }
    }

    return result;
  }

  static async updateContractStatus(contractId) {
    const contract = await this.getContractDetail(contractId);
    const allPaid = contract.installments.every(i => i.status === 'paid');

    if (allPaid) {
      await Contract.update(
        { status: 'paid_off' },
        { where: { id: contractId } }
      );
    }
  }
}

module.exports = ContractService;
