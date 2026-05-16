package com.dependency.license.controller;

import com.dependency.license.dto.ApiResponse;
import com.dependency.license.model.AuditLog;
import com.dependency.license.repository.AuditLogRepository;
import com.dependency.license.service.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/audit")
@RequiredArgsConstructor
@Tag(name = "审计日志", description = "操作审计日志查询和导出")
public class AuditController {
    private final AuditLogRepository auditLogRepository;
    private final ExportService exportService;

    @GetMapping
    @Operation(summary = "获取所有审计日志", description = "查询所有操作的审计日志")
    public ApiResponse<List<AuditLog>> getAllLogs() {
        return ApiResponse.success(auditLogRepository.findAll());
    }

    @GetMapping("/failures")
    @Operation(summary = "获取失败日志", description = "查询所有操作失败的审计日志")
    public ApiResponse<List<AuditLog>> getFailureLogs() {
        return ApiResponse.success(auditLogRepository.findBySuccessFalse());
    }

    @GetMapping("/entity/{entityType}/{entityId}")
    @Operation(summary = "获取实体相关日志", description = "查询指定实体的所有操作日志")
    public ApiResponse<List<AuditLog>> getEntityLogs(@PathVariable String entityType,
                                                     @PathVariable Long entityId) {
        return ApiResponse.success(auditLogRepository.findByEntityTypeAndEntityId(entityType, entityId));
    }

    @GetMapping("/export")
    @Operation(summary = "导出审计日志", description = "导出所有审计日志为CSV文件")
    public ResponseEntity<byte[]> exportAuditLogs() {
        byte[] data = exportService.exportAuditLogs();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "audit-logs.csv");
        return ResponseEntity.ok().headers(headers).body(data);
    }
}