package com.sensitive.operation.controller;

import com.sensitive.operation.dto.*;
import com.sensitive.operation.enums.OperationStatus;
import com.sensitive.operation.model.SensitiveOperation;
import com.sensitive.operation.service.ExportService;
import com.sensitive.operation.service.SensitiveOperationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/operations")
@RequiredArgsConstructor
public class SensitiveOperationController {

    private final SensitiveOperationService operationService;
    private final ExportService exportService;

    @PostMapping
    public ApiResponse<SensitiveOperation> create(@Valid @RequestBody CreateOperationRequest request) {
        log.info("创建敏感操作请求: {}", request.getRequestId());
        SensitiveOperation operation = operationService.createOperation(request);
        return ApiResponse.success(operation);
    }

    @GetMapping("/{operationId}")
    public ApiResponse<SensitiveOperation> getById(@PathVariable String operationId) {
        SensitiveOperation operation = operationService.getById(operationId);
        return ApiResponse.success(operation);
    }

    @GetMapping
    public ApiResponse<List<SensitiveOperation>> list(
            @RequestParam(required = false) OperationStatus status,
            @RequestParam(required = false) String requesterId) {

        List<SensitiveOperation> operations;
        if (status != null) {
            operations = operationService.listByStatus(status);
        } else if (requesterId != null) {
            operations = operationService.listByRequester(requesterId);
        } else {
            operations = operationService.listAll();
        }
        return ApiResponse.success(operations);
    }

    @PostMapping("/{operationId}/confirm")
    public ApiResponse<SensitiveOperation> confirm(
            @PathVariable String operationId,
            @Valid @RequestBody ConfirmRequest request) {
        log.info("确认操作请求: {}, 确认人: {}", operationId, request.getConfirmerName());
        SensitiveOperation operation = operationService.confirm(operationId, request);
        return ApiResponse.success(operation);
    }

    @PostMapping("/{operationId}/reject")
    public ApiResponse<SensitiveOperation> reject(
            @PathVariable String operationId,
            @Valid @RequestBody RejectRequest request) {
        log.info("拒绝操作请求: {}, 拒绝人: {}", operationId, request.getRejectorName());
        SensitiveOperation operation = operationService.reject(operationId, request);
        return ApiResponse.success(operation);
    }

    @PostMapping("/{operationId}/cancel")
    public ApiResponse<SensitiveOperation> cancel(
            @PathVariable String operationId,
            @Valid @RequestBody CancelRequest request) {
        log.info("撤销操作请求: {}, 撤销人: {}", operationId, request.getCancellerName());
        SensitiveOperation operation = operationService.cancel(operationId, request);
        return ApiResponse.success(operation);
    }

    @PostMapping("/{operationId}/execute")
    public ApiResponse<SensitiveOperation> execute(
            @PathVariable String operationId,
            @RequestParam String token) {
        log.info("执行操作请求: {}", operationId);
        SensitiveOperation operation = operationService.execute(operationId, token);
        return ApiResponse.success(operation);
    }

    @GetMapping("/export/json")
    public ResponseEntity<byte[]> exportJson() throws Exception {
        byte[] data = exportService.exportToJson();
        String filename = "operations_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".json";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_JSON)
                .body(data);
    }

    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportCsv() {
        byte[] data = exportService.exportToCsv();
        String filename = "operations_" + LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".csv";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(data);
    }
}
