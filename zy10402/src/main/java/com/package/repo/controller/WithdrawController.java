package com.package.repo.controller;

import com.package.repo.model.dto.ApiResponse;
import com.package.repo.model.dto.ArbitrationRequestDto;
import com.package.repo.model.dto.WithdrawRequestDto;
import com.package.repo.model.entity.ImpactReport;
import com.package.repo.model.entity.WithdrawRequest;
import com.package.repo.model.enums.ResponseStatus;
import com.package.repo.service.ExportService;
import com.package.repo.service.ImpactCalculationService;
import com.package.repo.service.WithdrawService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/withdraw")
@RequiredArgsConstructor
@Slf4j
public class WithdrawController {

    private final WithdrawService withdrawService;
    private final ImpactCalculationService impactCalculationService;
    private final ExportService exportService;

    @PostMapping("/request")
    public ResponseEntity<ApiResponse<WithdrawRequest>> requestWithdraw(
            @Valid @RequestBody WithdrawRequestDto request) {
        try {
            WithdrawRequest result = withdrawService.requestWithdraw(request);
            ApiResponse<WithdrawRequest> response;

            if (result.getProcessingConclusion() != null &&
                    result.getProcessingConclusion().contains("需人工复核")) {
                response = ApiResponse.<WithdrawRequest>builder()
                        .status(ResponseStatus.PENDING_REVIEW)
                        .message("待人工复核")
                        .data(result)
                        .build();
            } else {
                response = ApiResponse.success("撤回申请已提交", result);
            }

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.failed(e.getMessage()));
        }
    }

    @PostMapping("/arbitrate")
    public ResponseEntity<ApiResponse<WithdrawRequest>> arbitrate(
            @Valid @RequestBody ArbitrationRequestDto request) {
        try {
            WithdrawRequest result = withdrawService.arbitrate(request);
            ApiResponse<WithdrawRequest> response;

            switch (result.getArbitrationResult()) {
                case AUTO_BLOCKED, REJECTED -> response = ApiResponse.<WithdrawRequest>builder()
                        .status(ResponseStatus.BLOCKED)
                        .message("撤回被拦截/拒绝")
                        .data(result)
                        .build();
                case APPROVED, AUTO_APPROVED -> response = ApiResponse.success("撤回已批准", result);
                default -> response = ApiResponse.pendingReview(result);
            }

            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.failed(e.getMessage()));
        }
    }

    @PostMapping("/{requestId}/compensate")
    public ResponseEntity<ApiResponse<WithdrawRequest>> compensate(
            @PathVariable String requestId,
            @RequestParam String operator,
            @RequestParam String reason) {
        try {
            WithdrawRequest result = withdrawService.compensate(requestId, operator, reason);
            return ResponseEntity.ok(ApiResponse.compensated("补偿完成", result));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(ApiResponse.failed(e.getMessage()));
        }
    }

    @GetMapping("/{requestId}")
    public ResponseEntity<ApiResponse<WithdrawRequest>> getRequest(@PathVariable String requestId) {
        return withdrawService.getRequest(requestId)
                .map(req -> ResponseEntity.ok(ApiResponse.success(req)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<WithdrawRequest>>> getAllRequests() {
        List<WithdrawRequest> requests = withdrawService.getAllRequests();
        return ResponseEntity.ok(ApiResponse.success(requests));
    }

    @GetMapping("/pending")
    public ResponseEntity<ApiResponse<List<WithdrawRequest>>> getPendingRequests() {
        List<WithdrawRequest> requests = withdrawService.getPendingRequests();
        return ResponseEntity.ok(ApiResponse.success(requests));
    }

    @GetMapping("/{requestId}/impact-reports")
    public ResponseEntity<ApiResponse<List<ImpactReport>>> getImpactReports(
            @PathVariable String requestId) {
        List<ImpactReport> reports = impactCalculationService.getImpactReportsForRequest(requestId);
        return ResponseEntity.ok(ApiResponse.success(reports));
    }

    @GetMapping("/export/csv")
    public ResponseEntity<String> exportWithdrawRequestsCsv() {
        String csv = exportService.exportWithdrawRequestsToCsv();
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=utf-8")
                .body(csv);
    }

    @GetMapping("/{requestId}/export/csv")
    public ResponseEntity<String> exportImpactReportsCsv(@PathVariable String requestId) {
        String csv = exportService.exportImpactReportsToCsv(requestId);
        return ResponseEntity.ok()
                .header("Content-Type", "text/csv; charset=utf-8")
                .body(csv);
    }
}
