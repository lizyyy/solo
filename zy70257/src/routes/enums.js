const express = require('express');
const router = express.Router();
const { success } = require('../utils/response');
const enums = require('../utils/enums');

router.get('/', (req, res) => {
  res.json(success({
    prescriptionStatus: {
      values: enums.PRESCRIPTION_STATUS,
      labels: enums.PRESCRIPTION_STATUS_LABELS
    },
    batchStatus: {
      values: enums.BATCH_STATUS,
      labels: enums.BATCH_STATUS_LABELS
    },
    workOrderStatus: {
      values: enums.WORK_ORDER_STATUS,
      labels: enums.WORK_ORDER_STATUS_LABELS
    },
    returnStatus: {
      values: enums.RETURN_STATUS,
      labels: enums.RETURN_STATUS_LABELS
    },
    departments: {
      values: enums.DEPARTMENTS,
      labels: enums.DEPARTMENT_LABELS
    },
    returnReasons: {
      values: enums.RETURN_REASONS,
      labels: enums.RETURN_REASON_LABELS
    }
  }, '获取枚举值成功'));
});

router.get('/return-reasons', (req, res) => {
  res.json(success({
    values: enums.RETURN_REASONS,
    labels: enums.RETURN_REASON_LABELS
  }, '获取返修原因成功'));
});

router.get('/departments', (req, res) => {
  res.json(success({
    values: enums.DEPARTMENTS,
    labels: enums.DEPARTMENT_LABELS
  }, '获取部门列表成功'));
});

module.exports = router;
