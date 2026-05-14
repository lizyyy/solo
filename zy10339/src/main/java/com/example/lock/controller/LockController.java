package com.example.lock.controller;

import com.example.lock.dto.ApiResponse;
import com.example.lock.dto.LockRequest;
import com.example.lock.dto.LockResponse;
import com.example.lock.dto.ReleaseRequest;
import com.example.lock.entity.ReleaseAudit;
import com.example.lock.entity.ResourceLock;
import com.example.lock.entity.WaitQueueItem;
import com.example.lock.service.ResourceLockService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/locks")
@RequiredArgsConstructor
public class LockController {

    private final ResourceLockService lockService;

    @PostMapping("/acquire")
    public ApiResponse<LockResponse> acquireLock(@Valid @RequestBody LockRequest request) {
        LockResponse response = lockService.acquireLock(request);
        return ApiResponse.success(response, request.getRequestId());
    }

    @PostMapping("/release")
    public ApiResponse<LockResponse> releaseLock(@Valid @RequestBody ReleaseRequest request) {
        LockResponse response = lockService.releaseLock(request);
        return ApiResponse.success(response, request.getRequestId());
    }

    @GetMapping("/{resourceId}")
    public ApiResponse<ResourceLock> getLockStatus(@PathVariable String resourceId) {
        Optional<ResourceLock> lock = lockService.getLockByResourceId(resourceId);
        return lock.map(resourceLock -> ApiResponse.success(resourceLock))
                   .orElseGet(() -> ApiResponse.error(404, "锁不存在"));
    }

    @GetMapping("/{resourceId}/queue")
    public ApiResponse<List<WaitQueueItem>> getWaitQueue(@PathVariable String resourceId) {
        List<WaitQueueItem> queue = lockService.getWaitQueue(resourceId);
        return ApiResponse.success(queue);
    }

    @GetMapping("/{resourceId}/history")
    public ApiResponse<List<ReleaseAudit>> getReleaseHistory(
            @PathVariable String resourceId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        List<ReleaseAudit> history;
        if (startTime != null && endTime != null) {
            history = lockService.getReleaseHistoryByTimeRange(resourceId, startTime, endTime);
        } else {
            history = lockService.getReleaseHistory(resourceId);
        }
        return ApiResponse.success(history);
    }

    @GetMapping
    public ApiResponse<List<ResourceLock>> getAllLocks() {
        List<ResourceLock> locks = lockService.getAllLocks();
        return ApiResponse.success(locks);
    }

    @GetMapping("/{resourceId}/export")
    public ApiResponse<Map<String, Object>> exportLockStatus(@PathVariable String resourceId) {
        Map<String, Object> exportData = lockService.exportLockStatus(resourceId);
        return ApiResponse.success(exportData);
    }

    @GetMapping("/export")
    public ApiResponse<Map<String, Object>> exportAllLocks() {
        Map<String, Object> exportData = lockService.exportAllLocks();
        return ApiResponse.success(exportData);
    }
}
