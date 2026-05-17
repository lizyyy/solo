const dataStore = require('../store/DataStore');
const { ACCOUNT_STATUS, BORROW_STATUS, OPERATION_TYPE } = require('../models/AccountStatus');
const moment = require('moment');

const DEFAULT_LEASE_HOURS = 8;

class AccountService {
  createAccount(accountData) {
    const existing = dataStore.getAccountByNumber(accountData.accountNumber);
    if (existing) {
      throw new Error(`账号 ${accountData.accountNumber} 已存在`);
    }

    const account = dataStore.addAccount({
      accountNumber: accountData.accountNumber,
      status: ACCOUNT_STATUS.AVAILABLE,
      description: accountData.description || '',
      currentBorrowId: null,
      currentBorrower: null,
      currentDevice: null,
      leaseExpireAt: null,
      totalBorrowCount: 0,
      lastBorrowAt: null,
      tags: accountData.tags || []
    });

    this.logOperation(OPERATION_TYPE.CREATE, account.id, {
      operator: accountData.operator || 'system',
      originalInput: accountData,
      reason: '创建账号'
    });

    return account;
  }

  borrowAccount(accountNumber, borrowData) {
    const account = dataStore.getAccountByNumber(accountNumber);
    if (!account) {
      throw new Error(`账号 ${accountNumber} 不存在`);
    }

    const activeBorrow = dataStore.getActiveBorrowByAccount(account.id);
    if (activeBorrow) {
      throw new Error(`账号 ${accountNumber} 已被 ${activeBorrow.borrower} 占用，设备: ${activeBorrow.device}`);
    }

    if (account.status !== ACCOUNT_STATUS.AVAILABLE) {
      throw new Error(`账号 ${accountNumber} 当前状态不可借用: ${account.status}`);
    }

    const leaseHours = borrowData.leaseHours || DEFAULT_LEASE_HOURS;
    const leaseExpireAt = moment().add(leaseHours, 'hours').toISOString();

    const borrowRecord = dataStore.addBorrowRecord({
      accountId: account.id,
      accountNumber: account.accountNumber,
      borrower: borrowData.borrower,
      purpose: borrowData.purpose,
      device: borrowData.device,
      expectedReturnAt: leaseExpireAt,
      status: BORROW_STATUS.ACTIVE,
      borrowReport: null
    });

    dataStore.updateAccount(account.id, {
      status: ACCOUNT_STATUS.IN_USE,
      currentBorrowId: borrowRecord.id,
      currentBorrower: borrowData.borrower,
      currentDevice: borrowData.device,
      leaseExpireAt: leaseExpireAt,
      totalBorrowCount: account.totalBorrowCount + 1,
      lastBorrowAt: new Date().toISOString()
    });

    this.logOperation(OPERATION_TYPE.BORROW, account.id, {
      operator: borrowData.borrower,
      originalInput: borrowData,
      reason: '借用账号',
      borrowRecordId: borrowRecord.id
    });

    return { account: dataStore.getAccountById(account.id), borrowRecord };
  }

  returnAccount(accountNumber, returnData) {
    const account = dataStore.getAccountByNumber(accountNumber);
    if (!account) {
      throw new Error(`账号 ${accountNumber} 不存在`);
    }

    const activeBorrow = dataStore.getActiveBorrowByAccount(account.id);
    if (!activeBorrow) {
      throw new Error(`账号 ${accountNumber} 当前未被借用`);
    }

    if (activeBorrow.borrower !== returnData.operator && !returnData.forceReturn) {
      throw new Error(`仅借用人 ${activeBorrow.borrower} 可归还，或使用 forceReturn 强制归还`);
    }

    const isOverdue = moment().isAfter(activeBorrow.expectedReturnAt);

    dataStore.updateBorrowRecord(activeBorrow.id, {
      status: isOverdue ? BORROW_STATUS.OVERDUE : BORROW_STATUS.RETURNED,
      actualReturnAt: new Date().toISOString(),
      borrowReport: returnData.borrowReport || null
    });

    dataStore.updateAccount(account.id, {
      status: ACCOUNT_STATUS.AVAILABLE,
      currentBorrowId: null,
      currentBorrower: null,
      currentDevice: null,
      leaseExpireAt: null
    });

    this.logOperation(OPERATION_TYPE.RETURN, account.id, {
      operator: returnData.operator,
      originalInput: returnData,
      reason: isOverdue ? '逾期归还账号' : '正常归还账号',
      borrowRecordId: activeBorrow.id
    });

    return { account: dataStore.getAccountById(account.id), borrowRecord: dataStore.getBorrowRecordById(activeBorrow.id) };
  }

  checkAndRecoverOverdue() {
    const now = moment();
    const recovered = [];

    const accounts = dataStore.getAllAccounts();
    for (const account of accounts) {
      if (account.leaseExpireAt && now.isAfter(account.leaseExpireAt)) {
        const activeBorrow = dataStore.getActiveBorrowByAccount(account.id);
        if (activeBorrow && activeBorrow.status !== BORROW_STATUS.OVERDUE) {
          dataStore.updateBorrowRecord(activeBorrow.id, {
            status: BORROW_STATUS.OVERDUE
          });

          dataStore.updateAccount(account.id, {
            status: ACCOUNT_STATUS.OVERDUE
          });

          this.logOperation(OPERATION_TYPE.OVERDUE_RECOVER, account.id, {
            operator: 'system',
            reason: '系统检测到账号逾期，自动标记为超时状态',
            borrowRecordId: activeBorrow.id,
            leaseExpireAt: account.leaseExpireAt
          });

          recovered.push({
            accountNumber: account.accountNumber,
            borrower: activeBorrow.borrower,
            leaseExpireAt: account.leaseExpireAt
          });
        }
      }
    }

    return recovered;
  }

  forceRecoverAccount(accountNumber, operator, reason) {
    const account = dataStore.getAccountByNumber(accountNumber);
    if (!account) {
      throw new Error(`账号 ${accountNumber} 不存在`);
    }

    const activeBorrow = dataStore.getActiveBorrowByAccount(account.id);
    if (!activeBorrow) {
      throw new Error(`账号 ${accountNumber} 当前未被借用`);
    }

    dataStore.updateBorrowRecord(activeBorrow.id, {
      status: BORROW_STATUS.ABNORMAL,
      actualReturnAt: new Date().toISOString(),
      borrowReport: `强制回收，原因: ${reason}`
    });

    dataStore.updateAccount(account.id, {
      status: ACCOUNT_STATUS.ABNORMAL,
      currentBorrowId: null,
      currentBorrower: null,
      currentDevice: null,
      leaseExpireAt: null
    });

    dataStore.addAbnormalRecord({
      accountId: account.id,
      accountNumber: account.accountNumber,
      borrowRecordId: activeBorrow.id,
      type: 'force_recover',
      reason: reason,
      operator: operator,
      originalBorrower: activeBorrow.borrower,
      originalDevice: activeBorrow.device
    });

    this.logOperation(OPERATION_TYPE.ABNORMAL_HANDLE, account.id, {
      operator: operator,
      reason: `强制回收账号: ${reason}`,
      borrowRecordId: activeBorrow.id
    });

    return { account: dataStore.getAccountById(account.id), borrowRecord: dataStore.getBorrowRecordById(activeBorrow.id) };
  }

  manualCorrect(accountNumber, correctData) {
    const account = dataStore.getAccountByNumber(accountNumber);
    if (!account) {
      throw new Error(`账号 ${accountNumber} 不存在`);
    }

    const originalData = { ...account };
    const updates = {};

    if (correctData.status !== undefined) {
      updates.status = correctData.status;
    }
    if (correctData.currentBorrower !== undefined) {
      updates.currentBorrower = correctData.currentBorrower;
    }
    if (correctData.currentDevice !== undefined) {
      updates.currentDevice = correctData.currentDevice;
    }
    if (correctData.leaseExpireAt !== undefined) {
      updates.leaseExpireAt = correctData.leaseExpireAt;
    }

    const updatedAccount = dataStore.updateAccount(account.id, updates);

    this.logOperation(OPERATION_TYPE.MANUAL_CORRECT, account.id, {
      operator: correctData.operator,
      originalInput: correctData,
      originalState: originalData,
      newState: updatedAccount,
      reason: correctData.reason || '人工修正账号状态'
    });

    return updatedAccount;
  }

  checkConflict(device) {
    const accounts = dataStore.getAllAccounts();
    const conflicts = accounts.filter(a => 
      a.currentDevice === device && 
      [ACCOUNT_STATUS.IN_USE, ACCOUNT_STATUS.OVERDUE].includes(a.status)
    );

    return conflicts.map(c => ({
      accountNumber: c.accountNumber,
      borrower: c.currentBorrower,
      device: c.currentDevice,
      leaseExpireAt: c.leaseExpireAt
    }));
  }

  getAccount(accountNumber) {
    return dataStore.getAccountByNumber(accountNumber);
  }

  getAllAccounts(filters = {}) {
    let accounts = dataStore.getAllAccounts();
    
    if (filters.status) {
      accounts = accounts.filter(a => a.status === filters.status);
    }
    if (filters.borrower) {
      accounts = accounts.filter(a => a.currentBorrower === filters.borrower);
    }
    if (filters.device) {
      accounts = accounts.filter(a => a.currentDevice === filters.device);
    }

    return accounts;
  }

  getBorrowHistory(accountNumber) {
    const account = dataStore.getAccountByNumber(accountNumber);
    if (!account) {
      throw new Error(`账号 ${accountNumber} 不存在`);
    }
    return dataStore.getBorrowRecordsByAccount(account.id);
  }

  getOperationLogs(accountNumber) {
    const account = dataStore.getAccountByNumber(accountNumber);
    if (!account) {
      throw new Error(`账号 ${accountNumber} 不存在`);
    }
    return dataStore.getOperationLogsByAccount(account.id);
  }

  getAllAbnormalRecords() {
    return dataStore.getAllAbnormalRecords();
  }

  logOperation(operationType, accountId, details) {
    dataStore.addOperationLog({
      operationType,
      accountId,
      operator: details.operator || 'system',
      reason: details.reason,
      originalInput: details.originalInput,
      originalState: details.originalState,
      newState: details.newState,
      borrowRecordId: details.borrowRecordId,
      metadata: {
        leaseExpireAt: details.leaseExpireAt
      }
    });
  }
}

module.exports = new AccountService();
