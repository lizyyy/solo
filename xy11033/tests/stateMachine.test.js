const { canPerformAction, getNextStatus, StateMachineError } = require('../src/services/stateMachine');
const { CHANGE_STATUSES, ACTIONS } = require('../src/constants/statuses');

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
  } catch (error) {
    console.log(`❌ ${description}`);
    console.error(`   错误: ${error.message}`);
    process.exitCode = 1;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

console.log('\n' + '='.repeat(60));
console.log('🧪 状态机单元测试');
console.log('='.repeat(60) + '\n');

test('pending_review 状态允许 approve 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.PENDING_REVIEW, ACTIONS.APPROVE);
  assert(result.allowed === true, 'pending_review 应该允许 approve');
});

test('pending_review 状态允许 reject 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.PENDING_REVIEW, ACTIONS.REJECT);
  assert(result.allowed === true, 'pending_review 应该允许 reject');
});

test('pending_review 状态允许 cancel 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.PENDING_REVIEW, ACTIONS.CANCEL);
  assert(result.allowed === true, 'pending_review 应该允许 cancel');
});

test('pending_review 状态不允许 complete 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.PENDING_REVIEW, ACTIONS.COMPLETE);
  assert(result.allowed === false, 'pending_review 不应该允许 complete');
});

test('approved 状态允许 start_execute 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.APPROVED, ACTIONS.START_EXECUTE);
  assert(result.allowed === true, 'approved 应该允许 start_execute');
});

test('approved 状态不允许 approve 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.APPROVED, ACTIONS.APPROVE);
  assert(result.allowed === false, 'approved 不应该允许 approve');
});

test('executing 状态允许 mark_abnormal 动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.EXECUTING, ACTIONS.MARK_ABNORMAL);
  assert(result.allowed === true, 'executing 应该允许 mark_abnormal');
});

test('completed 状态是终态，不允许任何动作', () => {
  const result = canPerformAction(CHANGE_STATUSES.COMPLETED, ACTIONS.CANCEL);
  assert(result.allowed === false, 'completed 是终态，不允许任何动作');
});

test('approve 动作将 pending_review 转换为 approved', () => {
  const nextStatus = getNextStatus(CHANGE_STATUSES.PENDING_REVIEW, ACTIONS.APPROVE);
  assert(nextStatus === CHANGE_STATUSES.APPROVED, '应该转换为 approved');
});

test('start_execute 动作将 approved 转换为 executing', () => {
  const nextStatus = getNextStatus(CHANGE_STATUSES.APPROVED, ACTIONS.START_EXECUTE);
  assert(nextStatus === CHANGE_STATUSES.EXECUTING, '应该转换为 executing');
});

test('complete 动作将 executing 转换为 completed', () => {
  const nextStatus = getNextStatus(CHANGE_STATUSES.EXECUTING, ACTIONS.COMPLETE);
  assert(nextStatus === CHANGE_STATUSES.COMPLETED, '应该转换为 completed');
});

test('mark_abnormal 动作将 executing 转换为 abnormal', () => {
  const nextStatus = getNextStatus(CHANGE_STATUSES.EXECUTING, ACTIONS.MARK_ABNORMAL);
  assert(nextStatus === CHANGE_STATUSES.ABNORMAL, '应该转换为 abnormal');
});

test('resolve_abnormal 动作将 abnormal 转换为 pending_review', () => {
  const nextStatus = getNextStatus(CHANGE_STATUSES.ABNORMAL, ACTIONS.RESOLVE_ABNORMAL);
  assert(nextStatus === CHANGE_STATUSES.PENDING_REVIEW, '应该转换为 pending_review');
});

test('无效状态转换抛出 StateMachineError', () => {
  let thrown = false;
  try {
    getNextStatus(CHANGE_STATUSES.COMPLETED, ACTIONS.APPROVE);
  } catch (error) {
    thrown = true;
    assert(error instanceof StateMachineError, '应该抛出 StateMachineError');
  }
  assert(thrown, '应该抛出异常');
});

console.log('\n' + '='.repeat(60));
console.log('✅ 状态机测试完成');
console.log('='.repeat(60) + '\n');
