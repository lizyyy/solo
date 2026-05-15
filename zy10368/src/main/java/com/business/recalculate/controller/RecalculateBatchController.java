package com.business.recalculate.controller;

import com.business.recalculate.dto.*;
import com.business.recalculate.service.RecalculateBatchService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/recalculate")
@RequiredArgsConstructor
public class RecalculateBatchController {

    private final RecalculateBatchService batchService;

    @PostMapping("/batches")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> createBatch(
            @Valid @RequestBody CreateBatchRequest request) {
        return ResponseEntity.ok(batchService.createBatch(request));
    }

    @GetMapping("/batches")
    public ResponseEntity<ApiResponse<List<BatchDetailResponse>>> listBatches() {
        return ResponseEntity.ok(batchService.listBatches());
    }

    @GetMapping("/batches/{batchNo}")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> getBatchDetail(
            @PathVariable String batchNo) {
        return ResponseEntity.ok(batchService.getBatchDetail(batchNo));
    }

    @PostMapping("/batches/{batchNo}/validate")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> validateBatch(
            @PathVariable String batchNo,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ResponseEntity.ok(batchService.validateBatch(batchNo, operator));
    }

    @PostMapping("/batches/{batchNo}/recalculate")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> startRecalculate(
            @PathVariable String batchNo,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ResponseEntity.ok(batchService.startRecalculate(batchNo, operator));
    }

    @PostMapping("/batches/{batchNo}/compare")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> compareResults(
            @PathVariable String batchNo,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ResponseEntity.ok(batchService.compareResults(batchNo, operator));
    }

    @PostMapping("/batches/{batchNo}/publish")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> publish(
            @PathVariable String batchNo,
            @RequestParam boolean approved,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ResponseEntity.ok(batchService.publish(batchNo, approved, reason, operator));
    }

    @PostMapping("/batches/{batchNo}/revoke")
    public ResponseEntity<ApiResponse<BatchDetailResponse>> revoke(
            @PathVariable String batchNo,
            @RequestParam(required = false) String reason,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ResponseEntity.ok(batchService.revoke(batchNo, reason, operator));
    }

    @GetMapping("/batches/{batchNo}/history")
    public ResponseEntity<ApiResponse<List<BatchDetailResponse.StatusHistoryResponse>>> getStatusHistory(
            @PathVariable String batchNo) {
        return ResponseEntity.ok(batchService.getStatusHistory(batchNo));
    }

    @GetMapping("/batches/{batchNo}/export")
    public ResponseEntity<ApiResponse<String>> exportResults(
            @PathVariable String batchNo) {
        return ResponseEntity.ok(batchService.exportResults(batchNo));
    }
}
