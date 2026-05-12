const moment = require('moment');
const { Collection, Contract, sequelize } = require('../models');

class CollectionService {
  static async createCollection(collectionData) {
    const {
      contractId,
      type,
      collector,
      collectionDate,
      result,
      promisePayDate,
      promisePayAmount,
      remark,
    } = collectionData;

    const collectionNo = `COL${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;

    return await Collection.create({
      collectionNo,
      contractId,
      type,
      collector,
      collectionDate,
      result,
      promisePayDate,
      promisePayAmount,
      remark,
    });
  }

  static async freezeCollection(contractId, freezeData) {
    const { freezeReason, freezeDays } = freezeData;

    const transaction = await sequelize.transaction();

    try {
      const contract = await Contract.findByPk(contractId, { transaction });
      if (!contract) {
        throw new Error('合同不存在');
      }

      const freezeUntil = moment().add(freezeDays, 'days').toDate();

      await Contract.update(
        {
          isInCollection: true,
          collectionFreezeUntil: freezeUntil,
        },
        { where: { id: contractId }, transaction }
      );

      await transaction.commit();

      return {
        contractId,
        freezeReason,
        freezeUntil,
        message: `催收已冻结，截止日期: ${moment(freezeUntil).format('YYYY-MM-DD')}`,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async unfreezeCollection(contractId) {
    await Contract.update(
      {
        collectionFreezeUntil: null,
      },
      { where: { id: contractId } }
    );

    return {
      contractId,
      message: '催收冻结已解除',
    };
  }

  static async getCollectionDetail(collectionId) {
    const collection = await Collection.findByPk(collectionId, {
      include: ['contract'],
    });

    if (!collection) {
      throw new Error('催收记录不存在');
    }

    return collection;
  }

  static async listCollections(contractId) {
    return await Collection.findAll({
      where: { contractId },
      order: [['collectionDate', 'DESC']],
    });
  }

  static async getCollectionStatus(contractId) {
    const contract = await Contract.findByPk(contractId);
    if (!contract) {
      throw new Error('合同不存在');
    }

    const today = moment();
    const isFrozen = contract.collectionFreezeUntil && 
      moment(contract.collectionFreezeUntil).isAfter(today);

    return {
      isInCollection: contract.isInCollection,
      isFrozen,
      freezeUntil: contract.collectionFreezeUntil,
      daysRemaining: isFrozen 
        ? moment(contract.collectionFreezeUntil).diff(today, 'days') 
        : 0,
    };
  }
}

module.exports = CollectionService;
