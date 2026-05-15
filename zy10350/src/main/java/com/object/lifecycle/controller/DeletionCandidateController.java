package com.object.lifecycle.controller;

import com.object.lifecycle.dto.ApiResponse;
import com.object.lifecycle.dto.CreateDeletionCandidateRequest;
import com.object.lifecycle.entity.AuditLog;
import com.object.lifecycle.entity.DeletionCandidate;
import com.object.lifecycle.enums.TaskStatus;
import com.object.lifecycle.service.AuditLogService;
import com.object.lifecycle.service.DeletionCandidateService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/deletion-candidates")
@RequiredArgsConstructor
public class DeletionCandidateController {

    private final DeletionCandidateService candidateService;
    private final AuditLogService auditLogService;

    @PostMapping
    public ApiResponse<DeletionCandidate> createCandidate(
            @Valid @RequestBody CreateDeletionCandidateRequest request) {
        DeletionCandidate candidate = candidateService.createCandidate(request);
        return ApiResponse.success("删除候选创建成功", candidate);
    }

    @GetMapping("/{id}")
    public ApiResponse<DeletionCandidate> getCandidate(@PathVariable Long id) {
        DeletionCandidate candidate = candidateService.getCandidateById(id);
        return ApiResponse.success(candidate);
    }

    @GetMapping
    public ApiResponse<List<DeletionCandidate>> getAllCandidates(
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Long ruleId) {
        if (status != null) {
            return ApiResponse.success(candidateService.getCandidatesByStatus(status));
        }
        if (ruleId != null) {
            return ApiResponse.success(candidateService.getCandidatesByRuleId(ruleId));
        }
        return ApiResponse.success(candidateService.getAllCandidates());
    }

    @PostMapping("/{id}/execute-delete")
    public ApiResponse<DeletionCandidate> executeDelete(@PathVariable Long id) {
        DeletionCandidate candidate = candidateService.markAsDeleted(id);
        return ApiResponse.success("对象已标记删除", candidate);
    }

    @PostMapping("/{id}/mark-exception")
    public ApiResponse<DeletionCandidate> markException(@PathVariable Long id,
            @RequestParam(required = false) String reason) {
        DeletionCandidate candidate = candidateService.markAsException(id, reason);
        return ApiResponse.success("已标记为例外", candidate);
    }

    @PostMapping("/{id}/cancel")
    public ApiResponse<DeletionCandidate> cancelCandidate(@PathVariable Long id) {
        DeletionCandidate candidate = candidateService.cancelCandidate(id);
        return ApiResponse.success("删除候选已撤销", candidate);
    }

    @GetMapping("/{id}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(@PathVariable Long id) {
        List<AuditLog> logs = auditLogService.getAuditLogs("DeletionCandidate", id.toString());
        return ApiResponse.success(logs);
    }
}
