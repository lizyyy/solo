package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.entity.AuditLog;
import com.hospital.oxygen.service.AuditService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/logs")
    public ApiResponse<List<AuditLog>> getLogs(
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) String resourceId) {
        return ApiResponse.success(auditService.getLogsByResource(resourceType, resourceId));
    }

    @GetMapping("/duplicates")
    public ApiResponse<List<AuditLog>> getDuplicateLogs() {
        return ApiResponse.success(auditService.getDuplicateLogs());
    }
}
