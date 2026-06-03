const express = require('express');
const router = express.Router();

const { STATUS, STATUS_LABEL, CHANGE_TYPE, CHANGE_TYPE_LABEL, ALLOWED_TRANSITIONS } = require('../utils/constants');
const { BOUNDARY_RULES } = require('../utils/boundary-rules');

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status_definitions: Object.keys(STATUS).map(key => ({
        code: STATUS[key],
        label: STATUS_LABEL[STATUS[key]],
        allowed_next: ALLOWED_TRANSITIONS[STATUS[key]] || []
      })),
      change_type_definitions: Object.keys(CHANGE_TYPE).map(key => ({
        code: CHANGE_TYPE[key],
        label: CHANGE_TYPE_LABEL[CHANGE_TYPE[key]]
      })),
      boundary_rules: BOUNDARY_RULES,
      three_step_process: {
        step1: {
          name: '托管确认页导入',
          description: '第一次导入托管确认页，记录原始行号和原始数据',
          api: 'POST /api/records/import',
          target_status: 'IMPORTED'
        },
        step2: {
          name: '补看除权日截图',
          description: '对账运营阿芬补看除权日截图，上传证据',
          api: 'POST /api/records/:id/screenshot',
          target_status: 'SCREENSHOT_REVIEWED 或 PENDING_MANAGER_REVIEW'
        },
        step3: {
          name: '更新对账说明',
          description: '根据核对情况更新对账说明',
          api: 'POST /api/records/:id/note',
          target_status: '保持当前状态'
        }
      },
      t1_to_t2_handling: {
        detection: '原始到账日与当前到账日相差1天，自动识别为T+1→T+2手工改动',
        auto_status: '自动进入 PENDING_MANAGER_REVIEW 状态',
        required_review: '必须由基金经理复核，不能自动标记为正常',
        review_api: 'POST /api/records/:id/manager-review',
        finalize_condition: '基金经理复核通过(MANAGER_APPROVED)后才能标记为正常(NORMAL)',
        revert: '支持回滚，回滚后恢复原始到账日，清除人工改动标记'
      }
    }
  });
});

router.get('/t1-to-t2', (req, res) => {
  res.json({
    success: true,
    data: BOUNDARY_RULES.T1_TO_T2_MANUAL
  });
});

router.get('/transitions', (req, res) => {
  res.json({
    success: true,
    data: ALLOWED_TRANSITIONS
  });
});

module.exports = router;
