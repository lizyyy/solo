package com.cache.orchestrator.controller;

import com.cache.orchestrator.domain.dto.ApiResponse;
import com.cache.orchestrator.domain.dto.BatchResponse;
import com.cache.orchestrator.domain.dto.ConfirmationRequest;
import com.cache.orchestrator.domain.dto.CreateBatchRequest;
import com.cache.orchestrator.domain.enums.BatchStatus;
import com.cache.orchestrator.service.ExportService;
import com.cache.orchestrator.service.InvalidationOrchestratorService;
import com.cache.orchestrator.service.RetryService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/v1/invalidation")
@RequiredArgsConstructor
public class InvalidationController {

    private final InvalidationOrchestratorService orchestratorService;
    private final ExportService exportService;
    private final RetryService retryService;

    @GetMapping("/health")
    public ApiResponse<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("service", "cache-invalidation-orchestrator");
        health.put("version", "1.0.0");
        health.put("timestamp", LocalDateTime.now());
        return ApiResponse.success("服务运行正常", health);
    }

    @PostMapping("/batches")
    public ApiResponse<BatchResponse> createBatch(@Valid @RequestBody CreateBatchRequest request) {
        log.info("收到创建批次请求, requestId: {}", request.getRequestId());
        BatchResponse response = orchestratorService.createBatch(request);
        return ApiResponse.success("批次创建成功", response);
    }

    @PostMapping("/batches/{batchId}/validate")
    public ApiResponse<BatchResponse> validateBatch(@PathVariable Long batchId) {
        log.info("收到校验批次请求, batchId: {}", batchId);
        BatchResponse response = orchestratorService.validateBatch(batchId);
        return ApiResponse.success("批次校验成功", response);
    }

    @PostMapping("/batches/{batchId}/start")
    public ApiResponse<BatchResponse> startProcessing(@PathVariable Long batchId) {
        log.info("收到开始处理请求, batchId: {}", batchId);
        BatchResponse response = orchestratorService.startProcessing(batchId);
        return ApiResponse.success("批次开始处理", response);
    }

    @PostMapping("/batches/{batchId}/confirm")
    public ApiResponse<BatchResponse> confirm(
            @PathVariable Long batchId,
            @Valid @RequestBody ConfirmationRequest request) {
        log.info("收到确认请求, batchId: {}, receiptId: {}", batchId, request.getReceiptId());
        BatchResponse response = orchestratorService.confirm(request, batchId);
        return ApiResponse.success("确认回执已处理", response);
    }

    @GetMapping("/batches/{batchId}")
    public ApiResponse<BatchResponse> getBatchStatus(@PathVariable Long batchId) {
        log.info("查询批次状态, batchId: {}", batchId);
        BatchResponse response = orchestratorService.getBatchStatus(batchId);
        return ApiResponse.success(response);
    }

    @GetMapping("/batches/request/{requestId}")
    public ApiResponse<BatchResponse> getBatchByRequestId(@PathVariable String requestId) {
        log.info("通过 requestId 查询批次, requestId: {}", requestId);
        BatchResponse response = orchestratorService.getBatchByRequestId(requestId);
        return ApiResponse.success(response);
    }

    @GetMapping("/batches/history")
    public ApiResponse<List<BatchResponse>> getBatchHistory(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        log.info("查询批次历史, 时间范围: {} - {}", startTime, endTime);
        List<BatchResponse> response = orchestratorService.getBatchHistory(startTime, endTime);
        return ApiResponse.success("共查询到 " + response.size() + " 条记录", response);
    }

    @GetMapping("/batches/status")
    public ApiResponse<List<BatchResponse>> getBatchesByStatus(
            @RequestParam List<BatchStatus> statuses) {
        log.info("按状态查询批次, statuses: {}", statuses);
        List<BatchResponse> response = orchestratorService.getBatchesByStatus(statuses);
        return ApiResponse.success("共查询到 " + response.size() + " 条记录", response);
    }

    @GetMapping("/batches/{batchId}/export")
    public ResponseEntity<byte[]> exportBatch(@PathVariable Long batchId) {
        log.info("导出批次详情, batchId: {}", batchId);
        byte[] csvData = exportService.exportBatchToCsv(batchId);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "batch_" + batchId + ".csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }

    @GetMapping("/batches/history/export")
    public ResponseEntity<byte[]> exportBatchHistory(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        log.info("导出批次历史, 时间范围: {} - {}", startTime, endTime);
        byte[] csvData = exportService.exportBatchHistoryToCsv(startTime, endTime);
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "batch_history.csv");
        headers.setCacheControl("must-revalidate, post-check=0, pre-check=0");
        
        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }

    @PostMapping("/batches/{batchId}/retry/{nodeId}")
    public ApiResponse<Map<String, Object>> retryNode(
            @PathVariable Long batchId,
            @PathVariable String nodeId) {
        log.info("触发节点重试, batchId: {}, nodeId: {}", batchId, nodeId);
        Map<String, Object> result = retryService.retryNode(batchId, nodeId);
        return ApiResponse.success("重试计划已启动", result);
    }

    @PostMapping("/batches/{batchId}/retry-all")
    public ApiResponse<Map<String, Object>> retryAllNodes(@PathVariable Long batchId) {
        log.info("触发批次所有节点重试, batchId: {}", batchId);
        Map<String, Object> result = retryService.retryAllNodes(batchId);
        return ApiResponse.success("批量重试已启动", result);
    }

    @GetMapping("/batches/{batchId}/retry-status")
    public ApiResponse<List<Map<String, Object>>> getRetryStatus(@PathVariable Long batchId) {
        log.info("查询批次重试状态, batchId: {}", batchId);
        List<Map<String, Object>> result = retryService.getRetryStatus(batchId);
        return ApiResponse.success(result);
    }
}
