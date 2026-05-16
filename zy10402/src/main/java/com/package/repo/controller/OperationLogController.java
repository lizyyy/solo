package com.package.repo.controller;

import com.package.repo.model.dto.ApiResponse;
import com.package.repo.model.entity.OperationLog;
import com.package.repo.repository.OperationLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/logs")
@RequiredArgsConstructor
public class OperationLogController {

    private final OperationLogRepository operationLogRepository;

    @GetMapping
    public ResponseEntity<ApiResponse<List<OperationLog>>> getAllLogs() {
        List<OperationLog> logs = operationLogRepository.findAll();
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/resource/{resourceKey}")
    public ResponseEntity<ApiResponse<List<OperationLog>>> getLogsByResource(
            @PathVariable String resourceKey) {
        List<OperationLog> logs = operationLogRepository
                .findByResourceKeyOrderByOperationTimeDesc(resourceKey);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/failed")
    public ResponseEntity<ApiResponse<List<OperationLog>>> getFailedLogs() {
        List<OperationLog> logs = operationLogRepository.findBySuccessFalse();
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/operation/{operationType}")
    public ResponseEntity<ApiResponse<List<OperationLog>>> getLogsByOperationType(
            @PathVariable String operationType) {
        List<OperationLog> logs = operationLogRepository
                .findByOperationTypeOrderByOperationTimeDesc(operationType);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }
}
