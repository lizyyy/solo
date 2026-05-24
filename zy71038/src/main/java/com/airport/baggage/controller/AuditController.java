package com.airport.baggage.controller;

import com.airport.baggage.dto.response.ApiResponse;
import com.airport.baggage.entity.AuditLog;
import com.airport.baggage.service.AuditService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/audit")
public class AuditController {
    private final AuditService auditService;

    public AuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping("/{entityType}/{entityId}")
    public ApiResponse<List<AuditLog>> getEntityAuditLogs(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        return ApiResponse.success(auditService.getEntityAuditLogs(entityType, entityId));
    }

    @GetMapping("/{entityType}")
    public ApiResponse<List<AuditLog>> getEntityTypeAuditLogs(@PathVariable String entityType) {
        return ApiResponse.success(auditService.getEntityTypeAuditLogs(entityType));
    }
}
