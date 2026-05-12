const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const { Repayment, Installment, Contract, sequelize } = require('../models');
const ContractService = require('./ContractService');

class RepaymentService {
  static async createRepayment(repaymentData) {
    const {
      contractId,
      installmentId,
      amount,
      repaymentDate,
      repaymentMethod,
      type = 'full',
      sourceId,
      operator,
      remark,
    } = repaymentData;

    if (sourceId) {
      const existingRepayment = await Repayment.findOne({
        where: { sourceId, status: 'success' },
      });
      if (existingRepayment) {
        return {
          isDuplicate: true,
          repayment: existingRepayment,
          message: '重复提交，该笔还款已处理',
        };
      }
    }

    const transaction = await sequelize.transaction();

    try {
      const repaymentNo = `RPY${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;

      const repayment = await Repayment.create({
        repaymentNo,
        contractId,
        installmentId,
        amount,
        repaymentDate,
        repaymentMethod,
        type,
        isPartial: type === 'partial',
        sourceId,
        operator,
        remark,
        status: 'success',
      }, { transaction });

      if (installmentId) {
        await this.applyRepaymentToInstallment(installmentId, amount, transaction);
      } else {
        await this.applyRepaymentToContract(contractId, amount, transaction);
      }

      await transaction.commit();
      await ContractService.updateContractStatus(contractId);

      return {
        isDuplicate: false,
        repayment: await Repayment.findByPk(repayment.id),
        message: '还款成功',
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async applyRepaymentToInstallment(installmentId, amount, transaction) {
    const installment = await Installment.findByPk(installmentId, { transaction });
    if (!installment) {
      throw new Error('账期不存在');
    }

    const newPaidAmount = parseFloat(installment.paidAmount) + parseFloat(amount);
    const newRemainingAmount = parseFloat(installment.totalAmount) - newPaidAmount;

    let status = installment.status;
    if (newRemainingAmount <= 0) {
      status = 'paid';
    } else if (newPaidAmount > 0) {
      status = 'partial';
    }

    await Installment.update(
      {
        paidAmount: newPaidAmount.toFixed(2),
        remainingAmount: Math.max(0, newRemainingAmount).toFixed(2),
        status,
        paidDate: status === 'paid' ? new Date() : null,
      },
      { where: { id: installmentId }, transaction }
    );
  }

  static async applyRepaymentToContract(contractId, amount, transaction) {
    const installments = await Installment.findAll({
      where: { contractId, status: ['pending', 'partial', 'overdue', 'forborne'] },
      order: [['installmentNo', 'ASC']],
      transaction,
    });

    let remainingAmount = parseFloat(amount);

    for (const installment of installments) {
      if (remainingAmount <= 0) break;

      const toPay = Math.min(parseFloat(installment.remainingAmount), remainingAmount);
      const newPaidAmount = parseFloat(installment.paidAmount) + toPay;
      const newRemainingAmount = parseFloat(installment.totalAmount) - newPaidAmount;

      let status = installment.status;
      if (newRemainingAmount <= 0) {
        status = 'paid';
      } else if (newPaidAmount > 0) {
        status = 'partial';
      }

      await Installment.update(
        {
          paidAmount: newPaidAmount.toFixed(2),
          remainingAmount: Math.max(0, newRemainingAmount).toFixed(2),
          status,
          paidDate: status === 'paid' ? new Date() : null,
        },
        { where: { id: installment.id }, transaction }
      );

      remainingAmount -= toPay;
    }

    if (remainingAmount > 0) {
      throw new Error('还款金额超过待还总额');
    }
  }

  static async getRepaymentDetail(repaymentId) {
    const repayment = await Repayment.findByPk(repaymentId, {
      include: ['contract', 'installment'],
    });

    if (!repayment) {
      throw new Error('还款记录不存在');
    }

    return repayment;
  }

  static async listRepayments(contractId) {
    return await Repayment.findAll({
      where: { contractId },
      order: [['repaymentDate', 'DESC']],
    });
  }

  static async calculateTrial(contractId, repaymentAmount) {
    const contract = await ContractService.getContractDetail(contractId);
    const installments = contract.installments.filter(i => 
      ['pending', 'partial', 'overdue', 'forborne'].includes(i.status)
    ).sort((a, b) => a.installmentNo - b.installmentNo);

    let remainingAmount = parseFloat(repaymentAmount);
    const trialDetails = [];

    for (const installment of installments) {
      if (remainingAmount <= 0) break;

      const toPay = Math.min(parseFloat(installment.remainingAmount), remainingAmount);
      const newRemaining = parseFloat(installment.remainingAmount) - toPay;

      trialDetails.push({
        installmentId: installment.id,
        installmentNo: installment.installmentNo,
        dueDate: installment.currentDueDate,
        totalAmount: installment.totalAmount,
        remainingAmount: installment.remainingAmount,
        paymentAmount: toPay.toFixed(2),
        newRemainingAmount: newRemaining.toFixed(2),
        statusAfter: newRemaining <= 0 ? 'paid' : 'partial',
      });

      remainingAmount -= toPay;
    }

    return {
      contractId,
      repaymentAmount,
      totalInstallmentsAffected: trialDetails.length,
      trialDetails,
      remainingUnapplied: remainingAmount.toFixed(2),
    };
  }
}

module.exports = RepaymentService;
