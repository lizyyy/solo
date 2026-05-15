package com.metadata.repair.controller;

import com.metadata.repair.dto.*;
import com.metadata.repair.entity.RepairException;
import com.metadata.repair.entity.RepairHistory;
import com.metadata.repair.service.MetadataRepairService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/repair")
@RequiredArgsConstructor
public class MetadataRepairController {
    private final MetadataRepairService metadataRepairService;

    @PostMapping("/batch")
    public ApiResponse<BatchResponse> createBatch(@Valid @RequestBody CreateBatchRequest request) {
        return metadataRepairService.createBatch(request);
    }

    @PostMapping("/batch/{batchNo}/validate")
    public ApiResponse<BatchResponse> validateBatch(
            @PathVariable String batchNo,
            @RequestParam(defaultValue = "system") String operator) {
        return metadataRepairService.validateBatch(batchNo, operator);
    }

    @PostMapping("/batch/{batchNo}/start")
    public ApiResponse<BatchResponse> startRepair(
            @PathVariable String batchNo,
            @RequestParam(defaultValue = "system") String operator) {
        return metadataRepairService.startRepair(batchNo, operator);
    }

    @GetMapping("/batch/{batchNo}/status")
    public ApiResponse<BatchResponse> getBatchStatus(@PathVariable String batchNo) {
        return metadataRepairService.getBatchStatus(batchNo);
    }

    @GetMapping("/batch/{batchNo}/report")
    public ApiResponse<RepairReport> getRepairReport(@PathVariable String batchNo) {
        return metadataRepairService.getRepairReport(batchNo);
    }

    @GetMapping("/batch/{batchNo}/history")
    public ApiResponse<List<RepairHistory>> getBatchHistory(@PathVariable String batchNo) {
        return metadataRepairService.getBatchHistory(batchNo);
    }

    @GetMapping("/batch/{batchNo}/exceptions")
    public ApiResponse<List<RepairException>> getBatchExceptions(@PathVariable String batchNo) {
        return metadataRepairService.getBatchExceptions(batchNo);
    }

    @GetMapping("/batches")
    public ApiResponse<List<BatchResponse>> listBatches() {
        return metadataRepairService.listBatches();
    }
}
