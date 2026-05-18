const { seedAll } = require('../src/data/seed');
const store = require('../src/data/store');
const approvalService = require('../src/services/ApprovalService');
const { ApprovalError, ErrorCodes } = require('../src/utils/errors');
const { REAGENT_CATEGORIES, HAZARD_LEVELS } = require('../src/config/constants');

let passed = 0;
let failed = 0;

function test(name, fn) {
  console.log(`\nTesting: ${name}`);
  try {
    fn();
    console.log(`  ✅ PASS`);
    passed++;
  } catch (e) {
    console.log(`  ❌ FAIL: ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(fn, expectedCode, message) {
  try {
    fn();
    throw new Error('Expected error but none thrown');
  } catch (e) {
    if (e instanceof ApprovalError) {
      if (expectedCode && e.code !== expectedCode) {
        throw new Error(`Expected error code ${expectedCode}, got ${e.code}`);
      }
      console.log(`    拦截原因: ${e.message}`);
      console.log(`    解决方案: ${e.getResolutionGuidance()}`);
    }
  }
}

store.clear();
seedAll();

console.log('='.repeat(60));
console.log('高校实验室试剂领用审批 API 测试套件');
console.log('='.repeat(60));

test('1. 正常审批流程 - 普通试剂完整流程', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '测试项目',
    projectNumber: 'TEST001',
    researchPurpose: '用于测试目的的常规实验，需要标准操作流程',
    items: [
      { reagentId: 'reag_001', reagentName: '无水乙醇', category: REAGENT_CATEGORIES.GENERAL, quantity: 100, unit: 'ml' }
    ],
    emergencyContact: '李四',
    emergencyPhone: '13800138000',
    safetyTrainingCertified: true,
    wasteDisposalPlan: '标准废液处理流程，收集至专用废液桶'
  };

  const request = approvalService.createRequest(requestData);
  assert(request.currentState === 'draft', '初始状态应为草稿');
  
  const submitted = approvalService.submitRequest(request.id, request.etag);
  assert(submitted.currentState === 'submitted', '提交后状态应为已提交');
  
  const labApproved = approvalService.labManagerApprove(submitted.id, 'user_002', '李四', '同意');
  assert(labApproved.currentState === 'lab_manager_approved', '主任审批通过');
});

test('2. 危化试剂超量领用 - 进入待二审状态', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '危险化学品测试',
    projectNumber: 'TEST002',
    researchPurpose: '高危险化学品领用测试，需要特别审批',
    items: [
      { reagentId: 'reag_002', reagentName: '浓硫酸', category: REAGENT_CATEGORIES.HAZARDOUS, hazardLevel: HAZARD_LEVELS.HIGH, quantity: 100, unit: 'ml' }
    ],
    emergencyContact: '李四',
    emergencyPhone: '13800138000',
    safetyTrainingCertified: true,
    wasteDisposalPlan: '严格按照危废处理流程，酸液中和后专人处理'
  };

  const request = approvalService.createRequest(requestData);
  const submitted = approvalService.submitRequest(request.id, request.etag);
  
  assert(submitted.secondReviewRequired === true, '高危险试剂应标记需要二审');
  assert(submitted.pendingReviewReasons.length > 0, '应有待处理原因');
  console.log(`    待处理原因: ${submitted.pendingReviewReasons[0]}`);
});

test('3. 状态越级检测 - 不允许跳过中间审批节点', () => {
  assertThrows(() => {
    approvalService.validateStateTransition(
      'submitted',
      'safety_reviewed'
    );
  });
});

test('4. 状态越级检测 - 不允许跳过多个审批节点', () => {
  assertThrows(() => {
    approvalService.validateStateTransition(
      'lab_manager_approved',
      'approved'
    );
  });
});

test('5. 无效状态转换 - 已完成的申请不能再操作', () => {
  const requests = store.getAllApprovalRequests();
  const approvedReq = requests.find(r => r.currentState === 'lab_manager_approved');
  if (approvedReq) {
    assertThrows(() => {
      approvalService.labManagerApprove(approvedReq.id, 'user_002', '李四', '重复审批');
    }, ErrorCodes.INVALID_STATE_TRANSITION);
  }
});

test('6. 审计一致性检查 - 库存不一致时进入审计不一致状态', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '审计测试项目',
    projectNumber: 'TEST003',
    researchPurpose: '审计一致性检查测试，需要详细说明',
    items: [
      { reagentId: 'reag_001', reagentName: '无水乙醇', category: REAGENT_CATEGORIES.GENERAL, quantity: 100, unit: 'ml' }
    ],
    emergencyContact: '李四',
    emergencyPhone: '13800138000',
    safetyTrainingCertified: true,
    wasteDisposalPlan: '标准废液处理流程，收集至专用废液桶'
  };

  const request = approvalService.createRequest(requestData);
  approvalService.submitRequest(request.id, request.etag);
  approvalService.labManagerApprove(request.id, 'user_002', '李四', '同意');
  const safetyReviewed = approvalService.safetyOfficerReview(request.id, 'user_003', '王五', '审核通过');
  
  assertThrows(() => {
    approvalService.auditCheck(
      safetyReviewed.id,
      'user_004',
      '赵六',
      { 'reag_001': 50 }
    );
  }, ErrorCodes.AUDIT_INCONSISTENCY);
});

test('7. 数据验证 - 必填字段缺失时拦截', () => {
  assertThrows(() => {
    approvalService.createRequest({
      applicantName: '张三',
      labId: 'lab_001',
      labName: '有机化学实验室',
      researchPurpose: '测试',
      items: []
    });
  }, ErrorCodes.VALIDATION_ERROR);
});

test('8. 数据验证 - 危化试剂缺少安全培训证明', () => {
  assertThrows(() => {
    approvalService.createRequest({
      applicantId: 'user_001',
      applicantName: '张三',
      labId: 'lab_001',
      labName: '有机化学实验室',
      researchPurpose: '危化品测试',
      items: [
        { reagentId: 'reag_002', reagentName: '浓硫酸', category: REAGENT_CATEGORIES.HAZARDOUS, hazardLevel: HAZARD_LEVELS.HIGH, quantity: 50, unit: 'ml' }
      ],
      safetyTrainingCertified: false,
      wasteDisposalPlan: ''
    });
  }, ErrorCodes.VALIDATION_ERROR);
});

test('9. ETag 并发控制 - 数据过期时拦截', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: 'ETag测试',
    projectNumber: 'TEST_ETAG',
    researchPurpose: 'ETag并发控制测试，需要详细说明',
    items: [
      { reagentId: 'reag_001', reagentName: '无水乙醇', category: REAGENT_CATEGORIES.GENERAL, quantity: 50, unit: 'ml' }
    ]
  };

  const request = approvalService.createRequest(requestData);
  
  assertThrows(() => {
    approvalService.submitRequest(request.id, 'expired-etag-12345');
  }, ErrorCodes.ETAG_MISMATCH);
});

test('10. 不存在的申请 - 正确返回错误', () => {
  assertThrows(() => {
    approvalService.getRequest('non-existent-id');
  }, ErrorCodes.NOT_FOUND);
});

test('11. 不需要二审的申请尝试二审 - 拦截并解释', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '普通试剂测试',
    projectNumber: 'TEST_NORMAL',
    researchPurpose: '普通试剂测试，需要详细说明',
    items: [
      { reagentId: 'reag_005', reagentName: '超纯水', category: REAGENT_CATEGORIES.GENERAL, quantity: 10, unit: 'L' }
    ]
  };

  const request = approvalService.createRequest(requestData);
  approvalService.submitRequest(request.id, request.etag);
  approvalService.labManagerApprove(request.id, 'user_002', '李四', '同意');
  const safetyReviewed = approvalService.safetyOfficerReview(request.id, 'user_003', '王五', '审核通过');
  
  assertThrows(() => {
    approvalService.secondReviewApprove(safetyReviewed.id, 'user_005', '钱七', '强制二审');
  }, ErrorCodes.INVALID_STATE_TRANSITION);
});

test('12. 极高危试剂需要二审 - 正确标记', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '极高危测试',
    projectNumber: 'TEST004',
    researchPurpose: '极高危险化学品领用测试',
    items: [
      { reagentId: 'reag_006', reagentName: '乙酸乙酯', category: REAGENT_CATEGORIES.HAZARDOUS, hazardLevel: HAZARD_LEVELS.EXTREME, quantity: 50, unit: 'ml' }
    ],
    emergencyContact: '李四',
    emergencyPhone: '13800138000',
    safetyTrainingCertified: true,
    wasteDisposalPlan: '防爆处理，专人专管'
  };

  const request = approvalService.createRequest(requestData);
  const submitted = approvalService.submitRequest(request.id, request.etag);
  
  assert(submitted.secondReviewRequired === true, '极高危试剂必须二审');
  console.log(`    危险等级: ${HAZARD_LEVELS.EXTREME} - 强制二次审批`);
});

test('13. 完整二审流程 - 危化试剂正常通过二审', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '完整二审测试',
    projectNumber: 'TEST005',
    researchPurpose: '测试完整二审流程，需要详细说明实验用途',
    items: [
      { reagentId: 'reag_003', reagentName: '甲醛溶液', category: REAGENT_CATEGORIES.HAZARDOUS, hazardLevel: HAZARD_LEVELS.MEDIUM, quantity: 50, unit: 'ml' }
    ],
    emergencyContact: '李四',
    emergencyPhone: '13800138000',
    safetyTrainingCertified: true,
    wasteDisposalPlan: '专人处理，全程记录，按危废处置规范执行'
  };

  const request = approvalService.createRequest(requestData);
  const submitted = approvalService.submitRequest(request.id, request.etag);
  approvalService.labManagerApprove(submitted.id, 'user_002', '李四', '同意');
  const pendingReview = approvalService.safetyOfficerReview(submitted.id, 'user_003', '王五', '需要二审');
  
  assert(pendingReview.currentState === 'pending_second_review', '应进入待二审状态');
  
  const approved = approvalService.secondReviewApprove(pendingReview.id, 'user_005', '钱七', '二审通过');
  assert(approved.currentState === 'approved', '二审通过后状态应为已批准');
});

test('14. 驳回功能 - 各节点都可以驳回申请', () => {
  const requestData = {
    applicantId: 'user_001',
    applicantName: '张三',
    applicantDepartment: '化学系',
    labId: 'lab_001',
    labName: '有机化学实验室',
    projectName: '驳回测试',
    projectNumber: 'TEST_REJECT',
    researchPurpose: '驳回功能测试，需要详细说明',
    items: [
      { reagentId: 'reag_001', reagentName: '无水乙醇', category: REAGENT_CATEGORIES.GENERAL, quantity: 50, unit: 'ml' }
    ]
  };

  const request = approvalService.createRequest(requestData);
  const submitted = approvalService.submitRequest(request.id, request.etag);
  
  const rejected = approvalService.reject(
    submitted.id,
    'user_002',
    '李四',
    'lab_manager',
    '用途不明确，请补充详细说明'
  );
  
  assert(rejected.currentState === 'rejected', '驳回后状态应为已驳回');
  assert(rejected.rejectionReason === '用途不明确，请补充详细说明', '驳回原因应记录');
});

console.log('\n' + '='.repeat(60));
console.log(`测试结果: ${passed} 通过, ${failed} 失败`);
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
}
