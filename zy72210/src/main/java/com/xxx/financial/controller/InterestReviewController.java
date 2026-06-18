package com.xxx.financial.controller;

import com.xxx.financial.dto.*;
import com.xxx.financial.enums.ReviewStatus;
import com.xxx.financial.model.*;
import com.xxx.financial.repository.ReviewRepository;
import com.xxx.financial.service.ExportService;
import com.xxx.financial.service.InterestReviewService;
import com.xxx.financial.service.SelfCheckService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.File;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

@RestController
@RequestMapping("/api/review")
@CrossOrigin(origins = "*")
public class InterestReviewController {

    private final InterestReviewService reviewService;
    private final ExportService exportService;
    private final ReviewRepository repository;
    private final SelfCheckService selfCheckService;

    @Value("${review.export.dir:output}")
    private String exportDir;

    public InterestReviewController(InterestReviewService reviewService,
                                    ExportService exportService,
                                    ReviewRepository repository,
                                    SelfCheckService selfCheckService) {
        this.reviewService = reviewService;
        this.exportService = exportService;
        this.repository = repository;
        this.selfCheckService = selfCheckService;
    }

    @PostMapping("/init")
    public Map<String, Object> initReview(@RequestBody ReviewInitRequest req) {
        CommercialBill bill = new CommercialBill();
        bill.setBillNo(req.getBillNo());
        bill.setBillType(req.getBillType() != null ? req.getBillType() : "银行承兑汇票");
        bill.setFaceAmount(req.getFaceAmount());
        bill.setDiscountRate(req.getDiscountRate());
        bill.setDiscountDate(req.getDiscountDate() != null ? req.getDiscountDate() : new Date());
        bill.setMaturityDate(req.getMaturityDate() != null ? req.getMaturityDate()
                : new Date(System.currentTimeMillis() + 90L * 24 * 60 * 60 * 1000));
        bill.setDiscountInterest(req.getDiscountInterest());
        bill.setDrawer(req.getDrawer() != null ? req.getDrawer() : "贸易公司");
        bill.setDrawee(req.getDrawee() != null ? req.getDrawee() : "承兑银行");

        String operator = req.getOperator() != null ? req.getOperator() : "api_user";
        InterestReviewContext ctx = reviewService.initReview(bill, operator);

        List<BalanceChangeRecord> seed = new ArrayList<>();
        BalanceChangeRecord r = new BalanceChangeRecord();
        r.setRecordNo("BAL" + ctx.getReviewNo());
        r.setBillNo(bill.getBillNo());
        r.setPreviousBalance(BigDecimal.ZERO);
        r.setChangeAmount(bill.getDiscountInterest());
        r.setCurrentBalance(bill.getDiscountInterest());
        r.setChangeTime(new Date());
        r.setChangeReason("贴现利息入账");
        r.setOperator(operator);
        r.setRelatedBusinessNo("INT" + ctx.getReviewNo());
        seed.add(r);
        ctx.setBalanceHistory(seed);

        repository.saveContext(ctx);
        return buildContextResponse(ctx, "复核初始化成功");
    }

    @PostMapping("/step1/tail-adjustment")
    public Map<String, Object> step1Import(@RequestBody TailAdjustmentRequest req) {
        InterestReviewContext ctx = loadOrThrow(req.getReviewNo());

        TailAdjustment adj = new TailAdjustment();
        adj.setAdjustmentNo(req.getAdjustmentNo());
        adj.setBillNo(req.getBillNo() != null ? req.getBillNo() : ctx.getCommercialBill().getBillNo());
        adj.setAdjustmentAmount(req.getAdjustmentAmount());
        adj.setAdjustmentReason(req.getAdjustmentReason() != null ? req.getAdjustmentReason() : "尾差调整");
        adj.setApprover(req.getApprover());
        adj.setImportTime(req.getImportTime() != null ? req.getImportTime() : new Date());
        adj.setImportBatchNo(req.getImportBatchNo() != null ? req.getImportBatchNo() : "API_BATCH");
        adj.setRemark("");

        ReviewResult r = reviewService.step1ImportTailAdjustment(ctx, adj);
        repository.saveContext(ctx);
        return buildResultResponse(ctx, r);
    }

    @PostMapping("/manager-review")
    public Map<String, Object> managerReview(@RequestBody ManagerReviewRequest req) {
        InterestReviewContext ctx = loadOrThrow(req.getReviewNo());
        ReviewResult r = reviewService.managerReviewApprover(ctx, req.isApproved(),
                req.getRemark() != null ? req.getRemark() : "客户经理复核");
        repository.saveContext(ctx);
        return buildResultResponse(ctx, r);
    }

    @PostMapping("/step2/trustee-confirmation")
    public Map<String, Object> step2Trustee(@RequestBody TrusteeConfirmationRequest req) {
        InterestReviewContext ctx = loadOrThrow(req.getReviewNo());

        TrusteeConfirmation tc = new TrusteeConfirmation();
        tc.setConfirmationNo(req.getConfirmationNo());
        tc.setBillNo(req.getBillNo() != null ? req.getBillNo() : ctx.getCommercialBill().getBillNo());
        tc.setConfirmedInterest(req.getConfirmedInterest());
        tc.setConfirmedBalance(req.getConfirmedBalance() != null ? req.getConfirmedBalance() : req.getConfirmedInterest());
        tc.setConfirmationDate(req.getConfirmationDate() != null ? req.getConfirmationDate() : new Date());
        tc.setTrustee(req.getTrustee() != null ? req.getTrustee() : "托管银行");
        tc.setConfirmationStatus(req.getConfirmationStatus() != null ? req.getConfirmationStatus() : "已确认");
        tc.setRemark(req.getRemark());

        ReviewResult r = reviewService.step2ReviewTrusteeConfirmation(ctx, tc);
        repository.saveContext(ctx);
        return buildResultResponse(ctx, r);
    }

    @PostMapping("/resolve-conflict")
    public Map<String, Object> resolveConflict(@RequestBody ResolveConflictRequest req) {
        InterestReviewContext ctx = loadOrThrow(req.getReviewNo());
        ReviewResult r = reviewService.resolveConflict(ctx, req.getAdjustmentNo(),
                req.isConfirmAdjustment(),
                req.getDecisionRemark() != null ? req.getDecisionRemark() : "产品决策");
        repository.saveContext(ctx);
        return buildResultResponse(ctx, r);
    }

    @PostMapping("/step3/update-balance")
    public Map<String, Object> step3Update(@RequestParam String reviewNo) {
        InterestReviewContext ctx = loadOrThrow(reviewNo);
        ReviewResult r = reviewService.step3UpdateBalanceTable(ctx);
        repository.saveContext(ctx);
        return buildResultResponse(ctx, r);
    }

    @PostMapping("/self-check")
    public Map<String, Object> runSelfCheck(@RequestParam String reviewNo) {
        InterestReviewContext ctx = loadOrThrow(reviewNo);
        List<SelfCheckResult> results = selfCheckService.runAllChecks(ctx);
        boolean canContinue = !selfCheckService.hasAnyBlocking(results);
        repository.saveContext(ctx);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("reviewNo", reviewNo);
        resp.put("canContinue", canContinue);
        resp.put("selfCheckResults", results);
        resp.put("selfCheckReport", selfCheckService.formatSelfCheckReport(results));
        return resp;
    }

    @GetMapping("/{reviewNo}")
    public Map<String, Object> getContext(@PathVariable String reviewNo) {
        InterestReviewContext ctx = loadOrThrow(reviewNo);
        return buildContextResponse(ctx, "查询成功");
    }

    @GetMapping("/list")
    public List<Map<String, Object>> listAll() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (InterestReviewContext ctx : repository.findAll()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("reviewNo", ctx.getReviewNo());
            item.put("billNo", ctx.getCommercialBill() != null ? ctx.getCommercialBill().getBillNo() : null);
            item.put("status", ctx.getStatus().name());
            item.put("statusDesc", ctx.getStatus().getDescription());
            item.put("step1", ctx.isStep1ImportCompleted());
            item.put("step2", ctx.isStep2TrusteeReviewed());
            item.put("step3", ctx.isStep3BalanceUpdated());
            item.put("hasPinyinApprover", ctx.hasPinyinApprover());
            item.put("hasUnresolvedConflicts", ctx.hasUnresolvedConflicts());
            list.add(item);
        }
        return list;
    }

    @GetMapping(value = "/{reviewNo}/export/report", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<byte[]> exportReport(@PathVariable String reviewNo) throws Exception {
        InterestReviewContext ctx = loadOrThrow(reviewNo);
        ReviewResult finalResult = new ReviewResult(true, ctx.getStatus(), reviewNo);
        File f = exportService.exportReviewReport(ctx, finalResult, new File(exportDir));
        byte[] bytes = Files.readAllBytes(f.toPath());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + f.getName() + "\"")
                .contentType(MediaType.parseMediaType("text/plain; charset=UTF-8"))
                .body(bytes);
    }

    @GetMapping(value = "/{reviewNo}/export/balance-csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportBalanceCsv(@PathVariable String reviewNo) throws Exception {
        InterestReviewContext ctx = loadOrThrow(reviewNo);
        File f = exportService.exportBalanceCsv(ctx, new File(exportDir));
        byte[] bytes = Files.readAllBytes(f.toPath());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + f.getName() + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(bytes);
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "UP");
        m.put("totalReviews", repository.findAll().size());
        m.put("importedAdjustments", repository.getAllImportedAdjustments().size());
        return m;
    }

    private InterestReviewContext loadOrThrow(String reviewNo) {
        return repository.findByReviewNo(reviewNo)
                .orElseThrow(() -> new IllegalArgumentException("未找到复核单号: " + reviewNo));
    }

    private Map<String, Object> buildContextResponse(InterestReviewContext ctx, String msg) {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("message", msg);
        resp.put("reviewNo", ctx.getReviewNo());
        resp.put("status", ctx.getStatus().name());
        resp.put("statusDesc", ctx.getStatus().getDescription());
        resp.put("steps", new LinkedHashMap<String, Boolean>() {{
            put("step1ImportCompleted", ctx.isStep1ImportCompleted());
            put("step2TrusteeReviewed", ctx.isStep2TrusteeReviewed());
            put("step3BalanceUpdated", ctx.isStep3BalanceUpdated());
        }});
        resp.put("flags", new LinkedHashMap<String, Object>() {{
            put("hasPinyinApprover", ctx.hasPinyinApprover());
            put("hasUnresolvedConflicts", ctx.hasUnresolvedConflicts());
            put("allSelfCheckPassed", ctx.isAllSelfCheckPassed());
        }});
        resp.put("commercialBill", ctx.getCommercialBill());
        resp.put("tailAdjustment", ctx.getTailAdjustment());
        resp.put("trusteeConfirmation", ctx.getTrusteeConfirmation());
        resp.put("conflicts", ctx.getConflicts());
        resp.put("selfCheckResults", ctx.getSelfCheckResults());
        if (!ctx.getBalanceHistory().isEmpty()) {
            resp.put("finalBalance", ctx.getBalanceHistory()
                    .get(ctx.getBalanceHistory().size() - 1).getCurrentBalance());
        }
        return resp;
    }

    private Map<String, Object> buildResultResponse(InterestReviewContext ctx, ReviewResult r) {
        Map<String, Object> resp = buildContextResponse(ctx, r.getMessages() != null && !r.getMessages().isEmpty()
                ? r.getMessages().get(r.getMessages().size() - 1)
                : (r.isSuccess() ? "处理成功" : "需要人工介入"));
        resp.put("stepSuccess", r.isSuccess());
        resp.put("nextAction", r.getNextAction());
        resp.put("handler", r.getHandler());
        resp.put("messages", r.getMessages());
        resp.put("finalStatus", r.getFinalStatus() != null ? r.getFinalStatus().name() : null);
        resp.put("finalStatusDesc", r.getFinalStatus() != null ? r.getFinalStatus().getDescription() : null);
        if (r.getConflictReport() != null) {
            resp.put("conflicts", r.getConflictReport());
        }
        return resp;
    }
}
