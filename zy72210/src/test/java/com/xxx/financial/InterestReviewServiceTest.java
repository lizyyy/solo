package com.xxx.financial;

import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.ConflictEvidence;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.ReviewResult;
import com.xxx.financial.model.SelfCheckResult;
import com.xxx.financial.service.InterestReviewService;
import com.xxx.financial.util.TestDataBuilder;
import org.junit.Before;
import org.junit.Test;

import java.util.List;

import static org.junit.Assert.*;

public class InterestReviewServiceTest {

    private InterestReviewService reviewService;

    @Before
    public void setUp() {
        reviewService = new InterestReviewService();
    }

    @Test
    public void test_NormalMaterial_FullFlow_Success() {
        System.out.println("========== 场景1：正常材料全流程测试 ==========");

        InterestReviewContext context = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        ReviewResult step1 = reviewService.step1ImportTailAdjustment(
                context, TestDataBuilder.buildNormalTailAdjustment());

        printResult("步骤1结果", step1);
        assertTrue("步骤1应该成功", step1.isSuccess());
        assertEquals("状态应为正常流程", ReviewStatus.NORMAL, step1.getFinalStatus());
        assertEquals("下一步处理人应为支付平台产品阿南", "支付平台产品阿南", step1.getHandler());

        ReviewResult step2 = reviewService.step2ReviewTrusteeConfirmation(
                context, TestDataBuilder.buildNormalTrusteeConfirmation());

        printResult("步骤2结果", step2);
        assertTrue("步骤2应该成功", step2.isSuccess());
        assertEquals("状态应为正常流程", ReviewStatus.NORMAL, step2.getFinalStatus());

        ReviewResult step3 = reviewService.step3UpdateBalanceTable(context);

        printResult("步骤3结果", step3);
        assertTrue("步骤3应该成功", step3.isSuccess());
        assertEquals("状态应为复核通过", ReviewStatus.REVIEW_PASSED, step3.getFinalStatus());
        assertTrue("余额变化表应该已更新", context.isStep3BalanceUpdated());

        printSelfCheckReport(context);
        System.out.println("✓ 正常材料全流程测试通过\n");
    }

    @Test
    public void test_PinyinApprover_RequiresManagerReview() {
        System.out.println("========== 场景2：审批人只留拼音测试 ==========");

        InterestReviewContext context = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        ReviewResult step1 = reviewService.step1ImportTailAdjustment(
                context, TestDataBuilder.buildPinyinApproverTailAdjustment());

        printResult("步骤1结果", step1);
        assertFalse("步骤1因拼音审批人应返回非成功状态", step1.isSuccess());
        assertEquals("状态应为待客户经理复核", ReviewStatus.PENDING_MANAGER_REVIEW, step1.getFinalStatus());
        assertEquals("下一步处理人应为客户经理", "客户经理", step1.getHandler());
        assertTrue("应该标记拼音审批人标志", context.hasPinyinApprover());
        assertTrue("审批人备注应包含拼音提示",
                context.getTailAdjustment().getRemark().contains("审批人仅留拼音"));

        ReviewResult step2 = reviewService.step2ReviewTrusteeConfirmation(
                context, TestDataBuilder.buildNormalTrusteeConfirmation());

        printResult("步骤2结果（未经理复核前）", step2);
        assertFalse("步骤2应被拦截，需先完成经理复核", step2.isSuccess());
        assertEquals("状态仍为待客户经理复核", ReviewStatus.PENDING_MANAGER_REVIEW, step2.getFinalStatus());

        ReviewResult managerReview = reviewService.managerReviewApprover(
                context, true, "已核实zhang ming确为张明，审批有效");

        printResult("客户经理复核结果", managerReview);
        assertTrue("经理复核通过后应成功", managerReview.isSuccess());
        assertEquals("状态应为正常流程", ReviewStatus.NORMAL, managerReview.getFinalStatus());

        ReviewResult step2After = reviewService.step2ReviewTrusteeConfirmation(
                context, TestDataBuilder.buildNormalTrusteeConfirmation());

        printResult("步骤2结果（经理复核后）", step2After);
        assertTrue("步骤2应成功", step2After.isSuccess());

        ReviewResult step3 = reviewService.step3UpdateBalanceTable(context);

        printResult("步骤3结果", step3);
        assertTrue("步骤3应该成功", step3.isSuccess());
        assertEquals("状态应为复核通过", ReviewStatus.REVIEW_PASSED, step3.getFinalStatus());

        System.out.println("✓ 审批人拼音场景测试通过 - 正确拦截并转客户经理复核\n");
    }

    @Test
    public void test_DataConflict_RequiresProductDecision() {
        System.out.println("========== 场景3：尾差调整与托管确认冲突测试 ==========");

        InterestReviewContext context = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        ReviewResult step1 = reviewService.step1ImportTailAdjustment(
                context, TestDataBuilder.buildConflictTailAdjustment());

        printResult("步骤1结果", step1);
        assertTrue("步骤1应该成功", step1.isSuccess());

        ReviewResult step2 = reviewService.step2ReviewTrusteeConfirmation(
                context, TestDataBuilder.buildConflictTrusteeConfirmation());

        printResult("步骤2结果", step2);
        assertFalse("步骤2因冲突应返回非成功状态", step2.isSuccess());
        assertEquals("状态应为数据冲突待确认", ReviewStatus.DATA_CONFLICT, step2.getFinalStatus());
        assertEquals("下一步处理人应为支付平台产品阿南", "支付平台产品阿南", step2.getHandler());
        assertTrue("应该有未解决的冲突", context.hasUnresolvedConflicts());

        System.out.println("冲突证据列表：");
        for (ConflictEvidence conflict : context.getConflicts()) {
            System.out.println("  " + conflict.formatConflictReport());
        }

        ReviewResult step3BeforeResolve = reviewService.step3UpdateBalanceTable(context);

        printResult("步骤3结果（冲突未解决前）", step3BeforeResolve);
        assertFalse("冲突未解决时步骤3应被拦截", step3BeforeResolve.isSuccess());
        assertEquals("状态应为数据冲突待确认", ReviewStatus.DATA_CONFLICT, step3BeforeResolve.getFinalStatus());

        ReviewResult resolve = reviewService.resolveConflict(
                context, "ADJ20260601003", true, "经核实尾差调整金额正确，以尾差调整为准");

        printResult("冲突处理结果（支付平台产品阿南确认）", resolve);
        assertTrue("冲突解决后应返回成功", resolve.isSuccess());
        assertEquals("状态应为正常流程", ReviewStatus.NORMAL, resolve.getFinalStatus());
        assertFalse("应该没有未解决的冲突", context.hasUnresolvedConflicts());

        ReviewResult step3 = reviewService.step3UpdateBalanceTable(context);

        printResult("步骤3结果（冲突解决后）", step3);
        assertTrue("步骤3应该成功", step3.isSuccess());
        assertEquals("状态应为复核通过", ReviewStatus.REVIEW_PASSED, step3.getFinalStatus());

        System.out.println("✓ 数据冲突场景测试通过 - 正确列出冲突证据不自动拍板\n");
    }

    @Test
    public void test_SelfCheck_CoversAllRequiredItems() {
        System.out.println("========== 场景4：基本自检功能覆盖测试 ==========");

        InterestReviewContext context = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context.setTailAdjustment(TestDataBuilder.buildNormalTailAdjustment());
        context.setTrusteeConfirmation(TestDataBuilder.buildNormalTrusteeConfirmation());
        context.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        List<SelfCheckResult> results = reviewService.getSelfCheckService().runAllChecks(context);

        System.out.println(reviewService.getSelfCheckService().formatSelfCheckReport(results));

        assertEquals("自检应覆盖6项", 6, results.size());

        boolean hasDuplicateCheck = results.stream()
                .anyMatch(r -> r.getCheckItem().getDescription().contains("重复导入"));
        boolean hasPinyinCheck = results.stream()
                .anyMatch(r -> r.getCheckItem().getDescription().contains("审批人拼音"));
        boolean hasRecalculateCheck = results.stream()
                .anyMatch(r -> r.getCheckItem().getDescription().contains("补录后重算"));
        boolean hasExportCheck = results.stream()
                .anyMatch(r -> r.getCheckItem().getDescription().contains("导出一致性"));
        boolean hasBalanceMatchCheck = results.stream()
                .anyMatch(r -> r.getCheckItem().getDescription().contains("余额与历史匹配"));
        boolean hasConflictCheck = results.stream()
                .anyMatch(r -> r.getCheckItem().getDescription().contains("尾差与托管冲突"));

        assertTrue("应包含重复导入检查", hasDuplicateCheck);
        assertTrue("应包含审批人拼音检查", hasPinyinCheck);
        assertTrue("应包含补录后重算检查", hasRecalculateCheck);
        assertTrue("应包含导出一致性检查", hasExportCheck);
        assertTrue("应包含余额与历史匹配检查", hasBalanceMatchCheck);
        assertTrue("应包含尾差与托管冲突检查", hasConflictCheck);

        assertTrue("所有自检应通过", context.isAllSelfCheckPassed());

        System.out.println("✓ 基本自检功能覆盖测试通过\n");
    }

    @Test
    public void test_DuplicateImport_DetectedAndRejected() {
        System.out.println("========== 场景5：重复导入检测测试 ==========");

        InterestReviewContext context1 = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context1.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        ReviewResult step1a = reviewService.step1ImportTailAdjustment(
                context1, TestDataBuilder.buildNormalTailAdjustment());
        assertTrue("首次导入应成功", step1a.isSuccess());

        InterestReviewContext context2 = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员李四");
        context2.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        ReviewResult step1b = reviewService.step1ImportTailAdjustment(
                context2, TestDataBuilder.buildNormalTailAdjustment());

        printResult("重复导入结果", step1b);
        assertFalse("重复导入应被检测并拒绝", step1b.isSuccess());
        assertEquals("状态应为口径错误", ReviewStatus.CALIBER_ERROR, step1b.getFinalStatus());
        assertTrue("消息应包含重复导入提示",
                step1b.getMessages().stream().anyMatch(m -> m.contains("重复")));

        System.out.println("✓ 重复导入检测测试通过\n");
    }

    @Test
    public void test_ThreeStepFlow_WithPinyinAndConflict() {
        System.out.println("========== 场景6：三步完整流程（含拼音+冲突） ==========");

        InterestReviewContext context = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context.setBalanceHistory(TestDataBuilder.buildNormalBalanceHistory("CD20260601001"));

        System.out.println("【第一步】尾差调整条第一次导入");
        ReviewResult step1 = reviewService.step1ImportTailAdjustment(
                context, TestDataBuilder.buildPinyinApproverTailAdjustment());
        printResult("步骤1", step1);
        assertTrue("步骤1导入完成标志应为true", context.isStep1ImportCompleted());
        assertFalse("步骤2托管复核标志应为false", context.isStep2TrusteeReviewed());
        assertFalse("步骤3余额更新标志应为false", context.isStep3BalanceUpdated());

        System.out.println("\n【客户经理复核】审批人拼音确认");
        ReviewResult managerReview = reviewService.managerReviewApprover(
                context, true, "已核实zhang ming为张明，审批有效");
        printResult("经理复核", managerReview);

        System.out.println("\n【第二步】支付平台产品阿南补看托管确认页");
        ReviewResult step2 = reviewService.step2ReviewTrusteeConfirmation(
                context, TestDataBuilder.buildConflictTrusteeConfirmation());
        printResult("步骤2", step2);
        assertTrue("步骤2托管复核标志应为true", context.isStep2TrusteeReviewed());

        System.out.println("\n【支付平台产品阿南处理冲突】");
        ReviewResult resolve = reviewService.resolveConflict(
                context, context.getTailAdjustment().getAdjustmentNo(),
                false, "经核实托管数据正确，驳回尾差调整");
        printResult("冲突处理", resolve);

        System.out.println("\n【补录正确尾差调整后重算】");
        context.getTailAdjustment().setAdjustmentAmount(
                TestDataBuilder.buildNormalTrusteeConfirmation().getConfirmedInterest());
        List<SelfCheckResult> selfCheck = reviewService.getSelfCheckService().runAllChecks(context);
        System.out.println(reviewService.getSelfCheckService().formatSelfCheckReport(selfCheck));

        System.out.println("\n【第三步】余额变化表更新");
        ReviewResult step3 = reviewService.step3UpdateBalanceTable(context);
        printResult("步骤3", step3);
        assertTrue("步骤3余额更新标志应为true", context.isStep3BalanceUpdated());
        assertEquals("最终状态应为复核通过", ReviewStatus.REVIEW_PASSED, context.getStatus());

        System.out.println("\n流程完成状态：");
        System.out.println("  步骤1完成: " + context.isStep1ImportCompleted());
        System.out.println("  步骤2完成: " + context.isStep2TrusteeReviewed());
        System.out.println("  步骤3完成: " + context.isStep3BalanceUpdated());
        System.out.println("  最终余额: " + context.getBalanceHistory().get(context.getBalanceHistory().size() - 1).getCurrentBalance());

        System.out.println("✓ 三步完整流程（含拼音+冲突+补录）测试通过\n");
    }

    @Test
    public void test_BalanceHistory_InconsistentDetected() {
        System.out.println("========== 场景7：余额变化表不一致检测测试 ==========");

        InterestReviewContext context = reviewService.initReview(
                TestDataBuilder.buildNormalBill(), "操作员张三");
        context.setTailAdjustment(TestDataBuilder.buildNormalTailAdjustment());
        context.setTrusteeConfirmation(TestDataBuilder.buildNormalTrusteeConfirmation());
        context.setBalanceHistory(TestDataBuilder.buildInconsistentBalanceHistory("CD20260601001"));

        ReviewResult step1 = reviewService.step1ImportTailAdjustment(
                context, TestDataBuilder.buildNormalTailAdjustment());
        assertTrue("步骤1应该成功", step1.isSuccess());

        ReviewResult step2 = reviewService.step2ReviewTrusteeConfirmation(
                context, TestDataBuilder.buildNormalTrusteeConfirmation());
        assertTrue("步骤2应该成功", step2.isSuccess());

        ReviewResult step3 = reviewService.step3UpdateBalanceTable(context);

        printResult("步骤3结果（余额不一致时）", step3);
        assertFalse("余额不一致时步骤3应被拦截", step3.isSuccess());
        assertEquals("状态应为口径错误", ReviewStatus.CALIBER_ERROR, step3.getFinalStatus());
        assertTrue("消息应包含余额不匹配提示",
                step3.getMessages().stream().anyMatch(m -> m.contains("余额") || m.contains("匹配")));

        System.out.println("✓ 余额变化表不一致检测测试通过\n");
    }

    private void printResult(String title, ReviewResult result) {
        System.out.println("\n--- " + title + " ---");
        System.out.println(result.formatResultSummary());
        if (result.getMessages() != null && !result.getMessages().isEmpty()) {
            System.out.println("详细消息：");
            for (String msg : result.getMessages()) {
                System.out.println("  " + msg);
            }
        }
    }

    private void printSelfCheckReport(InterestReviewContext context) {
        System.out.println("\n" + reviewService.getSelfCheckService()
                .formatSelfCheckReport(context.getSelfCheckResults()));
    }
}
