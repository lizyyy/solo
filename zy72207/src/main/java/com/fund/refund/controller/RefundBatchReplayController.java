package com.fund.refund.controller;

import com.fund.refund.common.Result;
import com.fund.refund.dto.*;
import com.fund.refund.entity.AuditLog;
import com.fund.refund.entity.RefundBatch;
import com.fund.refund.entity.RefundDetail;
import com.fund.refund.entity.SelfCheckResult;
import com.fund.refund.service.ExportService;
import com.fund.refund.service.RefundBatchReplayService;
import com.fund.refund.service.SelfCheckService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/refund-batch-replay")
public class RefundBatchReplayController {

    @Autowired
    private RefundBatchReplayService replayService;

    @Autowired
    private SelfCheckService selfCheckService;

    @Autowired
    private ExportService exportService;

    @GetMapping("/batches")
    public Result<List<RefundBatch>> getBatchList() {
        return Result.success(replayService.getBatchList());
    }

    @PostMapping("/step1/import")
    public Result<RefundBatch> step1Import(@RequestBody BatchImportRequest request) {
        RefundBatch batch = replayService.step1ImportCustodianConfirmation(request);
        return Result.success(batch);
    }

    @PostMapping("/step2/evidence")
    public Result<RefundBatch> step2Evidence(@RequestBody EvidenceReviewRequest request) {
        RefundBatch batch = replayService.step2ReviewExDividendEvidence(request);
        return Result.success(batch);
    }

    @PostMapping("/step3/diff")
    public Result<RefundBatch> step3Diff(@RequestBody DiffUpdateRequest request) {
        RefundBatch batch = replayService.step3UpdateDiffList(request);
        return Result.success(batch);
    }

    @PostMapping("/supervisor/review")
    public Result<Void> supervisorReview(@RequestBody SupervisorReviewRequest request) {
        replayService.supervisorReview(request);
        return Result.success();
    }

    @GetMapping("/result/{batchId}")
    public Result<BatchReplayResultVO> getReplayResult(@PathVariable Long batchId) {
        BatchReplayResultVO result = replayService.getReplayResult(batchId);
        if (result == null) {
            return Result.error("批次不存在");
        }
        return Result.success(result);
    }

    @GetMapping("/details/{batchId}")
    public Result<List<RefundDetail>> getDetails(@PathVariable Long batchId) {
        return Result.success(replayService.getExportData(batchId));
    }

    @GetMapping("/self-check/{batchId}")
    public Result<List<SelfCheckResult>> getSelfCheckResults(@PathVariable Long batchId) {
        return Result.success(selfCheckService.getCheckResults(batchId));
    }

    @PostMapping("/self-check/run/{batchId}")
    public Result<List<SelfCheckResult>> runSelfCheck(@PathVariable Long batchId, @RequestParam String operator) {
        return Result.success(selfCheckService.runAllChecks(batchId, operator));
    }

    @GetMapping("/audit-logs/{batchId}")
    public Result<List<AuditLog>> getAuditLogs(@PathVariable Long batchId) {
        return Result.success(replayService.getAuditLogs(batchId));
    }

    @GetMapping("/export/{batchId}")
    public void exportDetails(@PathVariable Long batchId, HttpServletResponse response) throws IOException {
        exportService.exportDetails(batchId, response);
    }
}
