package com.xxx.financial.cli;

import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.BalanceChangeRecord;
import com.xxx.financial.model.CommercialBill;
import com.xxx.financial.model.ConflictEvidence;
import com.xxx.financial.model.InterestReviewContext;
import com.xxx.financial.model.ReviewResult;
import com.xxx.financial.model.TailAdjustment;
import com.xxx.financial.model.TrusteeConfirmation;
import com.xxx.financial.service.ExportService;
import com.xxx.financial.service.InterestReviewService;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;

public class InterestReviewCli {

    private static final String SEP = "============================================";
    private static final String SUB_SEP = "--------------------------------------------";

    public static void main(String[] args) {
        String scenario = args.length > 0 ? args[0] : "interactive";
        String outputDir = args.length > 1 ? args[1] : "output";

        System.out.println(SEP);
        System.out.println("  企业票据贴现利息复核系统 v1.0.0");
        System.out.println(SEP);
        System.out.println();

        if ("demo".equals(scenario) || "normal".equals(scenario)) {
            runDemo("normal", outputDir);
        } else if ("pinyin".equals(scenario)) {
            runDemo("pinyin", outputDir);
        } else if ("conflict".equals(scenario)) {
            runDemo("conflict", outputDir);
        } else if ("all".equals(scenario)) {
            runDemo("normal", outputDir);
            System.out.println();
            runDemo("pinyin", outputDir);
            System.out.println();
            runDemo("conflict", outputDir);
        } else {
            runInteractive(outputDir);
        }
    }

    private static void runDemo(String scenario, String outputDir) {
        InterestReviewService service = new InterestReviewService();
        ExportService exportService = new ExportService();

        System.out.println("【演示场景】" + getScenarioName(scenario));
        System.out.println();

        CommercialBill bill = buildDemoBill();
        TailAdjustment adj = buildDemoAdjustment(scenario);
        TrusteeConfirmation trustee = buildDemoTrustee(scenario);

        printBillInfo(bill);
        printTailAdjustment(adj);

        InterestReviewContext context = service.initReview(bill, "操作员张三");
        context.setBalanceHistory(buildDemoBalanceHistory(bill.getBillNo()));

        ReviewResult step1 = service.step1ImportTailAdjustment(context, adj);
        printStepResult("步骤1 尾差调整导入", step1, context);

        if (context.hasPinyinApprover()) {
            System.out.println();
            System.out.println(">> 审批人仅为拼音，自动模拟客户经理复核...");
            ReviewResult mgrReview = service.managerReviewApprover(context, true,
                    "已核实" + adj.getApprover() + "确为张明，审批有效");
            printStepResult("客户经理复核", mgrReview, context);
        }

        printTrusteeConfirmation(trustee);
        ReviewResult step2 = service.step2ReviewTrusteeConfirmation(context, trustee);
        printStepResult("步骤2 托管确认页复核", step2, context);

        if (context.hasUnresolvedConflicts()) {
            System.out.println();
            System.out.println(">> 检测到数据冲突，自动模拟支付平台产品阿南确认...");
            printConflictEvidence(context.getConflicts());
            ReviewResult resolve = service.resolveConflict(context,
                    context.getTailAdjustment().getAdjustmentNo(), true,
                    "经核实尾差调整金额正确，以尾差调整为准");
            printStepResult("冲突处理", resolve, context);
        }

        ReviewResult step3 = service.step3UpdateBalanceTable(context);
        printStepResult("步骤3 余额变化表更新", step3, context);

        printFinalSummary(context);

        try {
            File dir = new File(outputDir);
            File report = exportService.exportReviewReport(context, step3, dir);
            System.out.println("  复核报告已导出: " + report.getAbsolutePath());
            File csv = exportService.exportBalanceCsv(context, dir);
            System.out.println("  余额变化表已导出: " + csv.getAbsolutePath());
        } catch (IOException e) {
            System.err.println("导出失败: " + e.getMessage());
        }
    }

    private static void runInteractive(String outputDir) {
        InterestReviewService service = new InterestReviewService();
        ExportService exportService = new ExportService();
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

        System.out.println("交互模式：按步骤走完企业票据贴现利息复核流程");
        System.out.println("提示：直接回车使用默认值");
        System.out.println();

        try {
            CommercialBill bill = readBill(reader);
            TailAdjustment adj = readAdjustment(reader, bill.getBillNo());
            InterestReviewContext context = service.initReview(bill, "操作员张三");
            context.setBalanceHistory(buildDemoBalanceHistory(bill.getBillNo()));

            printBillInfo(bill);
            printTailAdjustment(adj);

            ReviewResult step1 = service.step1ImportTailAdjustment(context, adj);
            printStepResult("步骤1 尾差调整导入", step1, context);

            if (context.hasPinyinApprover()) {
                System.out.println();
                System.out.print(">> 审批人仅为拼音，是否确认审批人身份？(y/n) [y]: ");
                String confirm = reader.readLine().trim();
                boolean approved = confirm.isEmpty() || "y".equalsIgnoreCase(confirm);
                String remark = approved ? "客户经理确认审批人身份有效" : "审批人身份存疑";
                ReviewResult mgrReview = service.managerReviewApprover(context, approved, remark);
                printStepResult("客户经理复核", mgrReview, context);
                if (!approved) {
                    printFinalSummary(context);
                    return;
                }
            }

            TrusteeConfirmation trustee = readTrustee(reader, bill.getBillNo());
            printTrusteeConfirmation(trustee);
            ReviewResult step2 = service.step2ReviewTrusteeConfirmation(context, trustee);
            printStepResult("步骤2 托管确认页复核", step2, context);

            if (context.hasUnresolvedConflicts()) {
                System.out.println();
                printConflictEvidence(context.getConflicts());
                System.out.print(">> 支付平台产品阿南，确认尾差调整(1)还是驳回以托管为准(2)？[1]: ");
                String choice = reader.readLine().trim();
                boolean confirmAdjustment = choice.isEmpty() || "1".equals(choice);
                String remark = confirmAdjustment ? "以尾差调整为准" : "以托管确认页为准";
                ReviewResult resolve = service.resolveConflict(context,
                        context.getTailAdjustment().getAdjustmentNo(), confirmAdjustment, remark);
                printStepResult("冲突处理", resolve, context);
            }

            ReviewResult step3 = service.step3UpdateBalanceTable(context);
            printStepResult("步骤3 余额变化表更新", step3, context);

            printFinalSummary(context);

            File dir = new File(outputDir);
            File report = exportService.exportReviewReport(context, step3, dir);
            System.out.println("  复核报告已导出: " + report.getAbsolutePath());
            File csv = exportService.exportBalanceCsv(context, dir);
            System.out.println("  余额变化表已导出: " + csv.getAbsolutePath());

        } catch (IOException e) {
            System.err.println("输入异常: " + e.getMessage());
        }
    }

    private static CommercialBill readBill(BufferedReader reader) throws IOException {
        CommercialBill bill = new CommercialBill();
        System.out.print("票据号 [CD20260608001]: ");
        String billNo = reader.readLine().trim();
        bill.setBillNo(billNo.isEmpty() ? "CD20260608001" : billNo);
        bill.setBillType("银行承兑汇票");
        bill.setFaceAmount(new BigDecimal("1000000.00"));
        bill.setDiscountRate(new BigDecimal("3.65"));
        bill.setDiscountDate(new Date());
        bill.setMaturityDate(new Date(System.currentTimeMillis() + 90L * 24 * 60 * 60 * 1000));
        bill.setDiscountInterest(new BigDecimal("9000.00"));
        bill.setDrawer("ABC贸易有限公司");
        bill.setDrawee("XYZ银行");
        return bill;
    }

    private static TailAdjustment readAdjustment(BufferedReader reader, String billNo) throws IOException {
        TailAdjustment adj = new TailAdjustment();
        System.out.print("调整单号 [ADJ20260608001]: ");
        String adjNo = reader.readLine().trim();
        adj.setAdjustmentNo(adjNo.isEmpty() ? "ADJ20260608001" : adjNo);
        adj.setBillNo(billNo);
        System.out.print("调整金额 [12.50]: ");
        String amount = reader.readLine().trim();
        adj.setAdjustmentAmount(amount.isEmpty() ? new BigDecimal("12.50") : new BigDecimal(amount));
        adj.setAdjustmentReason("四舍五入尾差调整");
        System.out.print("审批人 [张明]: ");
        String approver = reader.readLine().trim();
        adj.setApprover(approver.isEmpty() ? "张明" : approver);
        adj.setImportTime(new Date());
        adj.setImportBatchNo("BATCH20260608");
        adj.setRemark("正常尾差调整");
        return adj;
    }

    private static TrusteeConfirmation readTrustee(BufferedReader reader, String billNo) throws IOException {
        TrusteeConfirmation tc = new TrusteeConfirmation();
        System.out.print("托管确认单号 [TC20260608001]: ");
        String confNo = reader.readLine().trim();
        tc.setConfirmationNo(confNo.isEmpty() ? "TC20260608001" : confNo);
        tc.setBillNo(billNo);
        System.out.print("托管确认利息 [9012.50]: ");
        String interest = reader.readLine().trim();
        tc.setConfirmedInterest(interest.isEmpty() ? new BigDecimal("9012.50") : new BigDecimal(interest));
        tc.setConfirmedBalance(tc.getConfirmedInterest());
        tc.setConfirmationDate(new Date());
        tc.setTrustee("中国工商银行托管部");
        tc.setConfirmationStatus("已确认");
        tc.setRemark("数据核对无误");
        return tc;
    }

    private static CommercialBill buildDemoBill() {
        CommercialBill bill = new CommercialBill();
        bill.setBillNo("CD20260608001");
        bill.setBillType("银行承兑汇票");
        bill.setFaceAmount(new BigDecimal("1000000.00"));
        bill.setDiscountRate(new BigDecimal("3.65"));
        bill.setDiscountDate(new Date());
        bill.setMaturityDate(new Date(System.currentTimeMillis() + 90L * 24 * 60 * 60 * 1000));
        bill.setDiscountInterest(new BigDecimal("9000.00"));
        bill.setDrawer("ABC贸易有限公司");
        bill.setDrawee("XYZ银行");
        return bill;
    }

    private static TailAdjustment buildDemoAdjustment(String scenario) {
        TailAdjustment adj = new TailAdjustment();
        adj.setBillNo("CD20260608001");
        adj.setAdjustmentReason("四舍五入尾差调整");
        adj.setImportTime(new Date());
        adj.setImportBatchNo("BATCH20260608");

        if ("pinyin".equals(scenario)) {
            adj.setAdjustmentNo("ADJ20260608002");
            adj.setAdjustmentAmount(new BigDecimal("12.50"));
            adj.setApprover("zhang ming");
            adj.setRemark("");
        } else if ("conflict".equals(scenario)) {
            adj.setAdjustmentNo("ADJ20260608003");
            adj.setAdjustmentAmount(new BigDecimal("15.80"));
            adj.setApprover("张明");
            adj.setRemark("尾差调整");
        } else {
            adj.setAdjustmentNo("ADJ20260608001");
            adj.setAdjustmentAmount(new BigDecimal("12.50"));
            adj.setApprover("张明");
            adj.setRemark("正常尾差调整");
        }
        return adj;
    }

    private static TrusteeConfirmation buildDemoTrustee(String scenario) {
        TrusteeConfirmation tc = new TrusteeConfirmation();
        tc.setConfirmationNo("TC20260608001");
        tc.setBillNo("CD20260608001");
        tc.setConfirmationDate(new Date());
        tc.setTrustee("中国工商银行托管部");
        tc.setConfirmationStatus("已确认");
        tc.setRemark("数据核对无误");

        if ("conflict".equals(scenario)) {
            tc.setConfirmedInterest(new BigDecimal("9010.50"));
            tc.setConfirmedBalance(new BigDecimal("9010.50"));
        } else {
            tc.setConfirmedInterest(new BigDecimal("9012.50"));
            tc.setConfirmedBalance(new BigDecimal("9012.50"));
        }
        return tc;
    }

    private static List<BalanceChangeRecord> buildDemoBalanceHistory(String billNo) {
        BalanceChangeRecord r1 = new BalanceChangeRecord();
        r1.setRecordNo("BAL00000001");
        r1.setBillNo(billNo);
        r1.setPreviousBalance(new BigDecimal("0.00"));
        r1.setChangeAmount(new BigDecimal("9000.00"));
        r1.setCurrentBalance(new BigDecimal("9000.00"));
        r1.setChangeTime(new Date(System.currentTimeMillis() - 86400000L));
        r1.setChangeReason("贴现利息入账");
        r1.setOperator("system");
        r1.setRelatedBusinessNo("INT20260608001");
        List<BalanceChangeRecord> list = new java.util.ArrayList<>();
        list.add(r1);
        return list;
    }

    private static String getScenarioName(String scenario) {
        switch (scenario) {
            case "normal": return "正常材料全流程";
            case "pinyin": return "审批人仅拼音（需客户经理复核）";
            case "conflict": return "尾差与托管冲突（需产品决策）";
            default: return scenario;
        }
    }

    private static void printBillInfo(CommercialBill bill) {
        System.out.println(SUB_SEP);
        System.out.println("  票据号: " + bill.getBillNo());
        System.out.println("  票据类型: " + bill.getBillType());
        System.out.println("  票面金额: " + bill.getFaceAmount());
        System.out.println("  贴现利率: " + bill.getDiscountRate() + "%");
        System.out.println("  贴现利息: " + bill.getDiscountInterest());
        System.out.println(SUB_SEP);
    }

    private static void printTailAdjustment(TailAdjustment adj) {
        System.out.println(SUB_SEP);
        System.out.println("  调整单号: " + adj.getAdjustmentNo());
        System.out.println("  调整金额: " + adj.getAdjustmentAmount());
        System.out.println("  调整原因: " + adj.getAdjustmentReason());
        System.out.println("  审批人: " + adj.getApprover());
        System.out.println(SUB_SEP);
    }

    private static void printTrusteeConfirmation(TrusteeConfirmation tc) {
        System.out.println(SUB_SEP);
        System.out.println("  确认单号: " + tc.getConfirmationNo());
        System.out.println("  确认利息: " + tc.getConfirmedInterest());
        System.out.println("  确认余额: " + tc.getConfirmedBalance());
        System.out.println("  托管方: " + tc.getTrustee());
        System.out.println(SUB_SEP);
    }

    private static void printStepResult(String stepName, ReviewResult result, InterestReviewContext context) {
        System.out.println();
        System.out.println(">> " + stepName);
        System.out.println("   状态: " + (result.isSuccess() ? "成功" : "需人工介入")
                + " | " + result.getFinalStatus().getDescription());
        if (result.getMessages() != null) {
            for (String msg : result.getMessages()) {
                System.out.println("   - " + msg);
            }
        }
        if (result.getNextAction() != null) {
            System.out.println("   下一步: " + result.getNextAction()
                    + " (处理人: " + result.getHandler() + ")");
        }
    }

    private static void printConflictEvidence(List<ConflictEvidence> conflicts) {
        System.out.println("  【冲突证据】");
        for (ConflictEvidence c : conflicts) {
            if (!c.isResolved()) {
                System.out.println("    " + c.formatConflictReport());
            }
        }
    }

    private static void printFinalSummary(InterestReviewContext context) {
        System.out.println();
        System.out.println(SEP);
        System.out.println("  复核完成汇总");
        System.out.println(SEP);
        System.out.println("  复核单号: " + context.getReviewNo());
        System.out.println("  票据号: " + context.getCommercialBill().getBillNo());
        System.out.println("  最终状态: " + context.getStatus().getDescription());
        System.out.println("  步骤1 尾差导入: " + (context.isStep1ImportCompleted() ? "已完成" : "未完成"));
        System.out.println("  步骤2 托管复核: " + (context.isStep2TrusteeReviewed() ? "已完成" : "未完成"));
        System.out.println("  步骤3 余额更新: " + (context.isStep3BalanceUpdated() ? "已完成" : "未完成"));
        if (context.isStep3BalanceUpdated() && !context.getBalanceHistory().isEmpty()) {
            BigDecimal finalBalance = context.getBalanceHistory()
                    .get(context.getBalanceHistory().size() - 1).getCurrentBalance();
            System.out.println("  最终余额: " + finalBalance);
        }
        if (context.hasPinyinApprover()) {
            System.out.println("  拼音审批人: " + context.getTailAdjustment().getApprover()
                    + " (已复核: " + (context.getManagerReviewRemark() != null) + ")");
        }
        if (!context.getConflicts().isEmpty()) {
            System.out.println("  冲突记录: " + context.getConflicts().size() + "条 (已全部解决: "
                    + !context.hasUnresolvedConflicts() + ")");
        }
        System.out.println();

        if (!context.getBalanceHistory().isEmpty()) {
            System.out.println("  余额变化表:");
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
            System.out.printf("  %-12s %-12s %-12s %-12s %-18s %-12s%n",
                    "记录号", "期初余额", "变动金额", "期末余额", "变动时间", "变动原因");
            for (BalanceChangeRecord r : context.getBalanceHistory()) {
                System.out.printf("  %-12s %-12s %-12s %-12s %-18s %-12s%n",
                        r.getRecordNo(),
                        r.getPreviousBalance(),
                        r.getChangeAmount(),
                        r.getCurrentBalance(),
                        r.getChangeTime() != null ? sdf.format(r.getChangeTime()) : "",
                        r.getChangeReason());
            }
        }
        System.out.println();
    }
}
