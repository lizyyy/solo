package com.approval.coordinator.controller;

import com.approval.coordinator.model.dto.*;
import com.approval.coordinator.model.entity.ApprovalBatch;
import com.approval.coordinator.model.entity.ApprovalItem;
import com.approval.coordinator.model.entity.ProcessingReceipt;
import com.approval.coordinator.model.entity.TimelineEvent;
import com.approval.coordinator.service.BatchService;
import com.approval.coordinator.service.ReceiptService;
import com.approval.coordinator.service.TimelineService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/batches")
@RequiredArgsConstructor
public class BatchController {

    private final BatchService batchService;
    private final ReceiptService receiptService;
    private final TimelineService timelineService;

    @PostMapping
    public ResponseEntity<ApiResponse<ApprovalBatch>> createBatch(@Valid @RequestBody BatchCreateRequest request) {
        ApiResponse<ApprovalBatch> response = batchService.createBatch(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{batchId}/start")
    public ResponseEntity<ApiResponse<ApprovalBatch>> startProcessing(
            @PathVariable String batchId,
            @RequestParam(required = false) String operator) {
        ApiResponse<ApprovalBatch> response = batchService.startProcessing(batchId, operator);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/callback")
    public ResponseEntity<ApiResponse<Map<String, Object>>> processCallback(
            @Valid @RequestBody CallbackResultRequest request) {
        ApiResponse<Map<String, Object>> response = batchService.processCallbackResult(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{batchId}/replay")
    public ResponseEntity<ApiResponse<Map<String, Object>>> replayItems(
            @PathVariable String batchId,
            @Valid @RequestBody ReplayRequest request) {
        request.setBatchId(batchId);
        ApiResponse<Map<String, Object>> response = batchService.replayItems(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}")
    public ResponseEntity<ApiResponse<ApprovalBatch>> getBatchDetail(@PathVariable String batchId) {
        ApiResponse<ApprovalBatch> response = batchService.getBatchDetail(batchId);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ApprovalBatch>>> listBatches(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(required = false) String sourceSystem) {
        ApiResponse<List<ApprovalBatch>> response = batchService.listBatches(startTime, endTime, sourceSystem);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/items")
    public ResponseEntity<ApiResponse<List<ApprovalItem>>> getBatchItems(@PathVariable String batchId) {
        ApiResponse<List<ApprovalItem>> response = batchService.getBatchItems(batchId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/items/failed")
    public ResponseEntity<ApiResponse<List<ApprovalItem>>> getFailedItems(@PathVariable String batchId) {
        ApiResponse<List<ApprovalItem>> response = batchService.getFailedItems(batchId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/timeline")
    public ResponseEntity<List<TimelineEvent>> getBatchTimeline(@PathVariable String batchId) {
        List<TimelineEvent> events = timelineService.getBatchTimeline(batchId);
        return ResponseEntity.ok(events);
    }

    @PostMapping("/{batchId}/receipts")
    public ResponseEntity<ApiResponse<ProcessingReceipt>> generateReceipt(
            @PathVariable String batchId,
            @RequestParam(required = false) String operator) {
        ApiResponse<ProcessingReceipt> response = receiptService.generateReceipt(batchId, operator);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/receipts")
    public ResponseEntity<ApiResponse<List<ProcessingReceipt>>> getBatchReceipts(@PathVariable String batchId) {
        ApiResponse<List<ProcessingReceipt>> response = receiptService.getBatchReceipts(batchId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{batchId}/debug-report")
    public ResponseEntity<ApiResponse<String>> exportDebugReport(@PathVariable String batchId) {
        ApiResponse<String> response = receiptService.exportDebugReport(batchId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/receipts/{receiptId}")
    public ResponseEntity<ApiResponse<ProcessingReceipt>> getReceipt(@PathVariable String receiptId) {
        ApiResponse<ProcessingReceipt> response = receiptService.getReceipt(receiptId);
        return ResponseEntity.ok(response);
    }
}
