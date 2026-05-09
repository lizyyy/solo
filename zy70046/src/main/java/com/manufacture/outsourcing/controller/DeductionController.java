package com.manufacture.outsourcing.controller;

import com.manufacture.outsourcing.common.Result;
import com.manufacture.outsourcing.dto.DeductionRecordRequest;
import com.manufacture.outsourcing.entity.DeductionRecord;
import com.manufacture.outsourcing.entity.DeductionRule;
import com.manufacture.outsourcing.service.DeductionService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/deductions")
public class DeductionController {

    private final DeductionService deductionService;

    public DeductionController(DeductionService deductionService) {
        this.deductionService = deductionService;
    }

    @PostMapping
    public Result<DeductionRecord> create(@Valid @RequestBody DeductionRecordRequest request) {
        return Result.success(deductionService.createDeductionRecord(request));
    }

    @GetMapping("/{id}")
    public Result<DeductionRecord> getById(@PathVariable Long id) {
        return Result.success(deductionService.getById(id));
    }

    @GetMapping("/inspection/{inspectionId}")
    public Result<List<DeductionRecord>> findByInspectionId(@PathVariable Long inspectionId) {
        return Result.success(deductionService.findByInspectionId(inspectionId));
    }

    @GetMapping("/order/{orderId}")
    public Result<List<DeductionRecord>> findByOrderId(@PathVariable Long orderId) {
        return Result.success(deductionService.findByOrderId(orderId));
    }

    @GetMapping("/failed")
    public Result<List<DeductionRecord>> findFailedRecords() {
        return Result.success(deductionService.findFailedRecords());
    }

    @PostMapping("/{id}/approve")
    public Result<DeductionRecord> approve(@PathVariable Long id,
                                            @RequestParam(required = false) String approvalRemark) {
        return Result.success(deductionService.approve(id, approvalRemark));
    }

    @PostMapping("/{id}/reject")
    public Result<DeductionRecord> reject(@PathVariable Long id,
                                           @RequestParam String approvalRemark) {
        return Result.success(deductionService.reject(id, approvalRemark));
    }

    @PostMapping("/{id}/retry")
    public Result<DeductionRecord> retry(@PathVariable Long id,
                                          @RequestParam(required = false) String retryDescription) {
        return Result.success(deductionService.retryExecution(id, retryDescription));
    }

    @GetMapping("/rules")
    public Result<List<DeductionRule>> findActiveRules() {
        return Result.success(deductionService.findActiveRules());
    }
}
