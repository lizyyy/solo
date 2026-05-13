const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

class DataStore {
  constructor() {
    this.warrantyChecks = [];
    this.inspectionReports = [];
    this.loanerDevices = [];
    this.replacementApprovals = [];
    this.oldDeviceRecoveries = [];
    this.afterSalesCosts = [];
    this.modificationHistory = [];
    this.initSampleData();
  }

  initSampleData() {
    const now = new Date();
    const handlers = ['张三', '李四', '王五', '赵六'];
    
    for (let i = 1; i <= 10; i++) {
      const orderNo = `AS${(2024000 + i).toString()}`;
      const handler = handlers[i % handlers.length];
      const checkDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      
      this.warrantyChecks.push({
        id: generateId(),
        orderNo,
        customerName: `客户${i}`,
        phone: `1380000${(1000 + i).toString().slice(-4)}`,
        deviceModel: ['iPhone 14', 'iPhone 15', 'Huawei Mate 60', 'Xiaomi 14'][i % 4],
        serialNo: `SN${Date.now()}-${i}`,
        purchaseDate: new Date(checkDate.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        warrantyExpiry: new Date(checkDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        warrantyStatus: ['在保', '过保', '延保'][i % 3],
        warrantyType: ['官方保修', '延保服务', 'AppleCare'][i % 3],
        checkResult: ['通过', '异常', '需进一步核实'][i % 3],
        handler,
        checkTime: checkDate.toISOString(),
        createdAt: checkDate.toISOString(),
        updatedAt: checkDate.toISOString()
      });

      this.inspectionReports.push({
        id: generateId(),
        orderNo,
        deviceModel: ['iPhone 14', 'iPhone 15', 'Huawei Mate 60', 'Xiaomi 14'][i % 4],
        serialNo: `SN${Date.now()}-${i}`,
        appearance: ['完好', '轻微划痕', '屏幕碎裂', '边框变形'][i % 4],
        functionTest: {
          screen: ['正常', '触控失灵', '显示异常'][i % 3],
          camera: ['正常', '无法拍照', '对焦失败'][i % 3],
          battery: ['正常', '续航不足', '无法充电'][i % 3],
          speaker: ['正常', '无声', '杂音'][i % 3]
        },
        faultDescription: ['无法开机', '屏幕闪烁', '电池鼓包', '摄像头故障'][i % 4],
        faultCategory: ['硬件故障', '软件问题', '人为损坏', '性能问题'][i % 4],
        repairSuggestion: ['换新', '维修', '无法修复', '返厂检测'][i % 4],
        estimatedCost: (i * 200 + 500),
        inspector: handler,
        inspectionTime: new Date(checkDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        status: ['待审核', '已通过', '已拒绝'][i % 3],
        createdAt: checkDate.toISOString(),
        updatedAt: checkDate.toISOString()
      });

      this.loanerDevices.push({
        id: generateId(),
        orderNo,
        loanerDeviceModel: ['iPhone 12', 'iPhone 13', 'iPhone SE', '备用机A'][i % 4],
        loanerSerialNo: `LN${Date.now()}-${i}`,
        borrower: `客户${i}`,
        borrowerPhone: `1380000${(1000 + i).toString().slice(-4)}`,
        loanDate: new Date(checkDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
        expectedReturnDate: new Date(checkDate.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        actualReturnDate: i % 3 === 0 ? new Date(checkDate.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString() : null,
        loanStatus: ['借用中', '已归还', '逾期未还'][i % 3],
        depositAmount: i * 500,
        handler,
        remarks: i % 2 === 0 ? '客户急需备用机' : '',
        createdAt: checkDate.toISOString(),
        updatedAt: checkDate.toISOString()
      });

      this.replacementApprovals.push({
        id: generateId(),
        orderNo,
        deviceModel: ['iPhone 14', 'iPhone 15', 'Huawei Mate 60', 'Xiaomi 14'][i % 4],
        serialNo: `SN${Date.now()}-${i}`,
        replacementReason: ['质量问题', '性能故障', '外观缺陷', '重复故障'][i % 4],
        replacementType: ['同型号换新', '升级换新', '折价换新'][i % 3],
        newDeviceModel: ['iPhone 14', 'iPhone 15', 'Huawei Mate 60', 'Xiaomi 14'][(i + 1) % 4],
        newSerialNo: `NSN${Date.now()}-${i}`,
        applicant: handler,
        applicationTime: new Date(checkDate.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        approver: handlers[(i + 1) % handlers.length],
        approvalTime: i % 2 === 0 ? new Date(checkDate.getTime() + 8 * 60 * 60 * 1000).toISOString() : null,
        approvalStatus: ['待审批', '已通过', '已拒绝'][i % 3],
        approvalComments: i % 2 === 0 ? '符合换新条件，同意' : '需补充检测报告',
        createdAt: checkDate.toISOString(),
        updatedAt: checkDate.toISOString()
      });

      this.oldDeviceRecoveries.push({
        id: generateId(),
        orderNo,
        deviceModel: ['iPhone 14', 'iPhone 15', 'Huawei Mate 60', 'Xiaomi 14'][i % 4],
        serialNo: `SN${Date.now()}-${i}`,
        recoveryStatus: ['待回收', '已回收', '回收中', '无法回收'][i % 4],
        recoveryMethod: ['上门取件', '客户寄送', '门店自送'][i % 3],
        trackingNo: i % 2 === 0 ? `SF${Date.now()}${i}` : null,
        recoveryTime: i % 2 === 0 ? new Date(checkDate.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString() : null,
        receiver: handlers[(i + 2) % handlers.length],
        warehouseLocation: ['A仓-01', 'B仓-02', 'C仓-03', '待入库'][i % 4],
        handler,
        remarks: i % 3 === 0 ? '包装完好，配件齐全' : '',
        createdAt: checkDate.toISOString(),
        updatedAt: checkDate.toISOString()
      });

      this.afterSalesCosts.push({
        id: generateId(),
        orderNo,
        costType: ['检测费', '配件费', '人工费', '运费', '备机折旧费'][i % 5],
        amount: (i * 100 + 50),
        costDescription: ['设备检测费用', '更换屏幕配件', '技术人员工时', '物流运输费用', '备机使用折旧'][i % 5],
        billingDepartment: ['售后部', '技术部', '物流部', '财务部'][i % 4],
        costBearer: ['公司承担', '客户承担', '保险公司', '供应商'][i % 4],
        settlementStatus: ['已结算', '待结算', '结算中'][i % 3],
        settlementTime: i % 3 === 0 ? new Date(checkDate.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString() : null,
        handler,
        remarks: '',
        createdAt: checkDate.toISOString(),
        updatedAt: checkDate.toISOString()
      });
    }
  }

  recordModification(type, recordId, oldValue, newValue, handler) {
    this.modificationHistory.push({
      id: generateId(),
      type,
      recordId,
      oldValue,
      newValue,
      handler,
      modifyTime: new Date().toISOString()
    });
  }

  getModificationHistory(type, recordId) {
    return this.modificationHistory.filter(m => m.type === type && m.recordId === recordId);
  }

  findByOrderNo(array, orderNo) {
    return array.find(item => item.orderNo === orderNo);
  }

  updateWarrantyCheck(id, data, handler) {
    const index = this.warrantyChecks.findIndex(w => w.id === id);
    if (index === -1) return null;
    const oldValue = JSON.parse(JSON.stringify(this.warrantyChecks[index]));
    const newValue = { ...this.warrantyChecks[index], ...data, updatedAt: new Date().toISOString() };
    this.warrantyChecks[index] = newValue;
    this.recordModification('warrantyCheck', id, oldValue, newValue, handler);
    return newValue;
  }

  updateInspectionReport(id, data, handler) {
    const index = this.inspectionReports.findIndex(r => r.id === id);
    if (index === -1) return null;
    const oldValue = JSON.parse(JSON.stringify(this.inspectionReports[index]));
    const newValue = { ...this.inspectionReports[index], ...data, updatedAt: new Date().toISOString() };
    this.inspectionReports[index] = newValue;
    this.recordModification('inspectionReport', id, oldValue, newValue, handler);
    return newValue;
  }

  updateLoanerDevice(id, data, handler) {
    const index = this.loanerDevices.findIndex(l => l.id === id);
    if (index === -1) return null;
    const oldValue = JSON.parse(JSON.stringify(this.loanerDevices[index]));
    const newValue = { ...this.loanerDevices[index], ...data, updatedAt: new Date().toISOString() };
    this.loanerDevices[index] = newValue;
    this.recordModification('loanerDevice', id, oldValue, newValue, handler);
    return newValue;
  }
}

module.exports = new DataStore();
