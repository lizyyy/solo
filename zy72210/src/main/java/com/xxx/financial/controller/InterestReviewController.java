package com.xxx.financial.controller;

import com.xxx.financial.dto.*;
import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.*;
import com.xxx.financial.service.ExportService;
import com.xxx.financial.service.InterestReviewService;
import com.xxx.financial.store.ReviewDataStore;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/review")
@CrossOrigin(origins = "*")
public class InterestReviewController {

    private final InterestReviewService reviewService;
    private final ReviewDataStore dataStore;
    private final ExportService exportService;
    private static final String OUTPUT_DIR = "output";

    @Autowired
    public InterestReviewController(ReviewDataStore dataStore) {
        this.dataStore = dataStore;
        this.reviewService = new InterestReviewService(dataStore);
        this.exportService = new ExportService();
    }

    @GetMapping("/")
    public ApiResponse<Map<String, Object>> getApiInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("name", "企业票据贴现利息复核 API");
        info.put("version", "1.0.0");
        info.put("endpoints", new String[]{
                "POST   /api/review/import          - 步骤1: 导入尾差调整条",
                "POST   /api/review/trustee         - 步骤2: 托管确认页复核",
                "POST   /api/review/conflict        - 冲突处理（产品决策）",
                "POST   /api/review/manager         - 客户经理复核（拼音审批人）",
                "POST   /api/review/balance         - 步骤3: 更新余额变化表",
                "GET    /api/review/{reviewNo}      - 查询复核详情",
                "GET    /api/review/list            - 查询所有复核记录",
                "GET    /api/review/{reviewNo}/export  - 导出复核报告",
                "GET    /api/review/{reviewNo}/balance - 导出余额CSV",
                "GET    /api/review/{reviewNo}/selfcheck - 重新执行自检",
                "DELETE /api/review/{reviewNo}      - 删除复核记录"
        });
        info.put("dataCount", dataStore.getAllContexts().size());
        info.put("importedAdjustments", dataStore.getAllImportedAdjustments().size());
        return ApiResponse.ok(info);
    }

    @PostMapping("/import")
    public ApiResponse<ReviewResult> step1Import(@Valid @RequestBody ImportTailAdjustmentRequest req) {
        CommercialBill bill = new CommercialBill();
        bill.setBillNo(req.getBillNo());
        bill.setBillType(req.getBillType());
        bill.setFaceAmount(req.getFaceAmount());
        bill.setDiscountRate(req.getDiscountRate());
        bill.setDiscountInterest(req.getDiscountInterest());
        bill.setDrawer(req.getDrawer());
        bill.setDrawee(req.getDrawee());
        bill.setDiscountDate(new Date());
        bill.setMaturityDate(new Date(System.currentTimeMillis() + 90L * 24 * 60 * 60 * 1000));

        TailAdjustment adj = new TailAdjustment();
        adj.setAdjustmentNo(req.getAdjustmentNo());
        adj.setBillNo(req.getBillNo());
        adj.setAdjustmentAmount(req.getAdjustmentAmount());
        adj.setAdjustmentReason(req.getAdjustmentReason() != null ? req.getAdjustmentReason() : "尾差调整");
        adj.setApprover(req.getApprover());
        adj.setImportBatchNo(req.getImportBatchNo() != null ? req.getImportBatchNo() : "BATCH" + System.currentTimeMillis());
        adj.setImportTime(new Date());

        String operator = req.getOperator() != null ? req.getOperator() : "API调用";
        InterestReviewContext context = reviewService.initReview(bill, operator);

        BalanceChangeRecord r1 = new BalanceChangeRecord();
        r1.setRecordNo("BAL" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        r1.setBillNo(req.getBillNo());
        r1.setPreviousBalance(BigDecimal.ZERO);
        r1.setChangeAmount(req.getDiscountInterest());
        r1.setCurrentBalance(req.getDiscountInterest());
        r1.setChangeTime(new Date());
        r1.setChangeReason("贴现利息入账");
        r1.setOperator("system");
        r1.setRelatedBusinessNo("INT" + System.currentTimeMillis());
        context.setBalanceHistory(new ArrayList<>(Collections.singletonList(r1)));

        ReviewResult result = reviewService.step1ImportTailAdjustment(context, adj);
        return new ApiResponse<>(result.isSuccess(),
                result.getMessages() != null && !result.getMessages().isEmpty() ?
                        result.getMessages().get(0) : "步骤1完成", result);
    }

    @PostMapping("/trustee")
    public ApiResponse<ReviewResult> step2Trustee(@Valid @RequestBody ReviewTrusteeRequest req) {
        InterestReviewContext context = dataStore.getContext(req.getReviewNo());
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + req.getReviewNo());
        }
        if (context.getStatus() == ReviewStatus.REVIEW_REJECTED) {
            return ApiResponse.error("该复核已被驳回，无法继续");
        }

        TrusteeConfirmation tc = new TrusteeConfirmation();
        tc.setConfirmationNo(req.getConfirmationNo());
        tc.setBillNo(context.getCommercialBill().getBillNo());
        tc.setConfirmedInterest(req.getConfirmedInterest());
        tc.setConfirmedBalance(req.getConfirmedBalance());
        tc.setConfirmationDate(new Date());
        tc.setTrustee(req.getTrustee() != null ? req.getTrustee() : "中国工商银行托管部");
        tc.setConfirmationStatus(req.getConfirmationStatus() != null ? req.getConfirmationStatus() : "已确认");
        tc.setRemark(req.getRemark());

        ReviewResult result = reviewService.step2ReviewTrusteeConfirmation(context, tc);
        return new ApiResponse<>(result.isSuccess(),
                result.getMessages() != null && !result.getMessages().isEmpty() ?
                        result.getMessages().get(0) : "步骤2完成", result);
    }

    @PostMapping("/conflict")
    public ApiResponse<ReviewResult> resolveConflict(@Valid @RequestBody ResolveConflictRequest req) {
        InterestReviewContext context = dataStore.getContext(req.getReviewNo());
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + req.getReviewNo());
        }

        boolean hasConflict = context.getConflicts().stream()
                .anyMatch(c -> req.getAdjustmentNo().equals(c.getAdjustmentNo()) && !c.isResolved());
        if (!hasConflict) {
            return ApiResponse.error("未找到待处理的冲突记录: " + req.getAdjustmentNo());
        }

        String remark = req.getDecisionRemark() != null ? req.getDecisionRemark() :
                (req.getConfirm() ? "产品确认以尾差调整为准" : "产品驳回以托管为准");

        ReviewResult result = reviewService.resolveConflict(context, req.getAdjustmentNo(),
                req.getConfirm(), remark);
        return new ApiResponse<>(result.isSuccess(),
                result.getMessages() != null && !result.getMessages().isEmpty() ?
                        result.getMessages().get(0) : "冲突处理完成", result);
    }

    @PostMapping("/manager")
    public ApiResponse<ReviewResult> managerReview(@Valid @RequestBody ManagerReviewRequest req) {
        InterestReviewContext context = dataStore.getContext(req.getReviewNo());
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + req.getReviewNo());
        }
        if (!context.hasPinyinApprover()) {
            return ApiResponse.error("该复核无需客户经理复核（审批人不是拼音）");
        }

        String remark = req.getRemark() != null ? req.getRemark() :
                (req.getApproved() ? "客户经理确认审批人身份有效" : "客户经理驳回，审批人身份存疑");

        ReviewResult result = reviewService.managerReviewApprover(context, req.getApproved(), remark);
        return new ApiResponse<>(result.isSuccess(),
                result.getMessages() != null && !result.getMessages().isEmpty() ?
                        result.getMessages().get(0) : "客户经理复核完成", result);
    }

    @PostMapping("/balance")
    public ApiResponse<ReviewResult> step3Balance(@RequestBody Map<String, String> body) {
        String reviewNo = body.get("reviewNo");
        if (reviewNo == null || reviewNo.trim().isEmpty()) {
            return ApiResponse.error("复核单号不能为空");
        }

        InterestReviewContext context = dataStore.getContext(reviewNo);
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + reviewNo);
        }
        if (context.getStatus() == ReviewStatus.REVIEW_REJECTED) {
            return ApiResponse.error("该复核已被驳回，无法继续");
        }
        if (context.hasUnresolvedConflicts()) {
            return ApiResponse.error("存在未解决的数据冲突，请先处理冲突");
        }
        if (context.hasPinyinApprover() && context.getManagerReviewRemark() == null) {
            return ApiResponse.error("审批人仅为拼音，需先完成客户经理复核");
        }
        if (!context.isStep2TrusteeReviewed()) {
            return ApiResponse.error("请先完成托管确认页复核");
        }

        ReviewResult result = reviewService.step3UpdateBalanceTable(context);
        return new ApiResponse<>(result.isSuccess(),
                result.getMessages() != null && !result.getMessages().isEmpty() ?
                        result.getMessages().get(0) : "步骤3完成", result);
    }

    @GetMapping("/list")
    public ApiResponse<List<Map<String, Object>>> listReviews(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String billNo) {
        List<InterestReviewContext> all = dataStore.getAllContexts();
        List<Map<String, Object>> result = new ArrayList<>();

        for (InterestReviewContext ctx : all) {
            if (status != null && !status.isEmpty() && !status.equals(ctx.getStatus().name())) {
                continue;
            }
            if (billNo != null && !billNo.isEmpty() && !billNo.equals(ctx.getCommercialBill().getBillNo())) {
                continue;
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("reviewNo", ctx.getReviewNo());
            item.put("billNo", ctx.getCommercialBill().getBillNo());
            item.put("status", ctx.getStatus().name());
            item.put("statusDesc", ctx.getStatus().getDescription());
            item.put("step1Import", ctx.isStep1ImportCompleted());
            item.put("step2TrusteeReview", ctx.isStep2TrusteeReviewed());
            item.put("step3BalanceUpdate", ctx.isStep3BalanceUpdated());
            item.put("hasPinyinApprover", ctx.hasPinyinApprover());
            item.put("hasUnresolvedConflicts", ctx.hasUnresolvedConflicts());
            item.put("operator", ctx.getOperator());
            result.add(item);
        }

        result.sort((a, b) -> ((String) b.get("reviewNo")).compareTo((String) a.get("reviewNo")));
        return ApiResponse.ok(result);
    }

    @GetMapping("/{reviewNo}/selfcheck")
    public ApiResponse<String> runSelfCheck(@PathVariable String reviewNo) {
        InterestReviewContext context = dataStore.getContext(reviewNo);
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + reviewNo);
        }

        List<SelfCheckResult> results = reviewService.getSelfCheckService().runAllChecks(context);
        dataStore.saveContext(context);
        String report = reviewService.getSelfCheckService().formatSelfCheckReport(results);
        return ApiResponse.ok("自检完成", report);
    }

    @GetMapping(value = "/{reviewNo}/export", produces = "text/plain; charset=UTF-8")
    public ResponseEntity<Resource> exportReport(@PathVariable String reviewNo) throws IOException {
        InterestReviewContext context = dataStore.getContext(reviewNo);
        if (context == null) {
            return ResponseEntity.notFound().build();
        }

        File outDir = new File(System.getProperty("user.dir"), OUTPUT_DIR).getAbsoluteFile();
        if (!outDir.exists()) {
            outDir.mkdirs();
        }

        ReviewResult finalResult = new ReviewResult(context.isStep3BalanceUpdated(),
                context.getStatus(), reviewNo);
        File file = exportService.exportReviewReport(context, finalResult, outDir).getAbsoluteFile();

        if (!file.exists() || file.length() == 0) {
            return ResponseEntity.status(500).build();
        }

        FileSystemResource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + file.getName() + "\"")
                .contentType(MediaType.parseMediaType("text/plain; charset=UTF-8"))
                .contentLength(file.length())
                .body(resource);
    }

    @GetMapping(value = "/{reviewNo}/balance", produces = "text/csv; charset=UTF-8")
    public ResponseEntity<Resource> exportBalance(@PathVariable String reviewNo) throws IOException {
        InterestReviewContext context = dataStore.getContext(reviewNo);
        if (context == null) {
            return ResponseEntity.notFound().build();
        }

        File outDir = new File(System.getProperty("user.dir"), OUTPUT_DIR).getAbsoluteFile();
        if (!outDir.exists()) {
            outDir.mkdirs();
        }

        File file = exportService.exportBalanceCsv(context, outDir).getAbsoluteFile();
        if (!file.exists() || file.length() == 0) {
            return ResponseEntity.status(500).build();
        }

        FileSystemResource resource = new FileSystemResource(file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + file.getName() + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .contentLength(file.length())
                .body(resource);
    }

    @DeleteMapping("/{reviewNo}")
    public ApiResponse<String> deleteReview(@PathVariable String reviewNo) {
        InterestReviewContext context = dataStore.getContext(reviewNo);
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + reviewNo);
        }
        dataStore.deleteContext(reviewNo);
        return ApiResponse.ok("删除成功: " + reviewNo, null);
    }

    @GetMapping("/{reviewNo}")
    public ApiResponse<Map<String, Object>> getReviewDetail(@PathVariable String reviewNo) {
        InterestReviewContext context = dataStore.getContext(reviewNo);
        if (context == null) {
            return ApiResponse.error("复核记录不存在: " + reviewNo);
        }

        Map<String, Object> detail = new LinkedHashMap<>();
        detail.put("reviewNo", context.getReviewNo());
        detail.put("billNo", context.getCommercialBill().getBillNo());
        detail.put("status", context.getStatus().name());
        detail.put("statusDesc", context.getStatus().getDescription());
        detail.put("operator", context.getOperator());

        Map<String, Boolean> steps = new LinkedHashMap<>();
        steps.put("step1Import", context.isStep1ImportCompleted());
        steps.put("step2TrusteeReview", context.isStep2TrusteeReviewed());
        steps.put("step3BalanceUpdate", context.isStep3BalanceUpdated());
        detail.put("steps", steps);

        if (context.getTailAdjustment() != null) {
            Map<String, Object> adj = new LinkedHashMap<>();
            adj.put("adjustmentNo", context.getTailAdjustment().getAdjustmentNo());
            adj.put("adjustmentAmount", context.getTailAdjustment().getAdjustmentAmount());
            adj.put("approver", context.getTailAdjustment().getApprover());
            adj.put("approverType", context.getTailAdjustment().getApproverType().getDescription());
            adj.put("isPinyinApprover", context.getTailAdjustment().isPinyinApproverFlag());
            detail.put("tailAdjustment", adj);
        }

        if (context.getTrusteeConfirmation() != null) {
            Map<String, Object> tc = new LinkedHashMap<>();
            tc.put("confirmationNo", context.getTrusteeConfirmation().getConfirmationNo());
            tc.put("confirmedInterest", context.getTrusteeConfirmation().getConfirmedInterest());
            tc.put("confirmedBalance", context.getTrusteeConfirmation().getConfirmedBalance());
            detail.put("trusteeConfirmation", tc);
        }

        if (context.getConflicts() != null && !context.getConflicts().isEmpty()) {
            detail.put("conflicts", context.getConflicts().stream().map(c -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("adjustmentNo", c.getAdjustmentNo());
                m.put("conflictType", c.getConflictType());
                m.put("description", c.getDescription());
                m.put("resolved", c.isResolved());
                m.put("resolution", c.getResolution());
                return m;
            }).collect(Collectors.toList()));
        }

        detail.put("managerReviewRemark", context.getManagerReviewRemark());
        detail.put("productDecision", context.getProductDecision());

        Map<String, Object> selfCheck = new LinkedHashMap<>();
        List<SelfCheckResult> checks = context.getSelfCheckResults();
        selfCheck.put("total", checks.size());
        selfCheck.put("passed", context.getSelfCheckPassedCount());
        selfCheck.put("blockingErrors", context.getSelfCheckBlockingErrorCount());
        selfCheck.put("warnings", context.getSelfCheckWarningCount());
        selfCheck.put("hasBlockingErrors", context.hasBlockingErrors());
        detail.put("selfCheckSummary", selfCheck);
        detail.put("selfCheckDetails", checks.stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("item", r.getCheckItem().getDescription());
            m.put("passed", r.isPassed());
            m.put("severity", r.getSeverity().getLabel());
            m.put("message", r.getMessage());
            m.put("overridden", r.isOverridden());
            m.put("overrideReason", r.getOverrideReason());
            return m;
        }).collect(Collectors.toList()));

        if (context.isStep3BalanceUpdated() && !context.getBalanceHistory().isEmpty()) {
            detail.put("currentBalance", context.getBalanceHistory()
                    .get(context.getBalanceHistory().size() - 1).getCurrentBalance());
        }

        return ApiResponse.ok(detail);
    }

    @ExceptionHandler(Exception.class)
    public ApiResponse<String> handleException(Exception e) {
        return ApiResponse.error("系统异常: " + e.getMessage());
    }
}
