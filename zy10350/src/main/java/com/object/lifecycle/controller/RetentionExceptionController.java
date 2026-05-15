package com.object.lifecycle.controller;

import com.object.lifecycle.dto.ApiResponse;
import com.object.lifecycle.dto.CreateRetentionExceptionRequest;
import com.object.lifecycle.entity.AuditLog;
import com.object.lifecycle.entity.RetentionException;
import com.object.lifecycle.service.AuditLogService;
import com.object.lifecycle.service.RetentionExceptionService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/retention-exceptions")
@RequiredArgsConstructor
public class RetentionExceptionController {

    private final RetentionExceptionService exceptionService;
    private final AuditLogService auditLogService;

    @PostMapping
    public ApiResponse<RetentionException> createException(
            @Valid @RequestBody CreateRetentionExceptionRequest request) {
        RetentionException exception = exceptionService.createException(request);
        return ApiResponse.success("保留例外创建成功", exception);
    }

    @GetMapping("/{id}")
    public ApiResponse<RetentionException> getException(@PathVariable Long id) {
        RetentionException exception = exceptionService.getExceptionById(id);
        return ApiResponse.success(exception);
    }

    @GetMapping
    public ApiResponse<List<RetentionException>> getAllExceptions(
            @RequestParam(required = false) String objectKey,
            @RequestParam(required = false) String bucketName) {
        if (objectKey != null && bucketName != null) {
            return ApiResponse.success(exceptionService.getExceptionsByObject(objectKey, bucketName));
        }
        return ApiResponse.success(exceptionService.getAllExceptions());
    }

    @PatchMapping("/{id}/toggle")
    public ApiResponse<RetentionException> toggleException(@PathVariable Long id,
            @RequestParam boolean enabled) {
        RetentionException exception = exceptionService.toggleException(id, enabled);
        return ApiResponse.success("保留例外状态更新成功", exception);
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteException(@PathVariable Long id) {
        exceptionService.deleteException(id);
        return ApiResponse.success("保留例外删除成功", null);
    }

    @GetMapping("/{id}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(@PathVariable Long id) {
        List<AuditLog> logs = auditLogService.getAuditLogs("RetentionException", id.toString());
        return ApiResponse.success(logs);
    }
}
