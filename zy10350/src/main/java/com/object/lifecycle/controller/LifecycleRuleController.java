package com.object.lifecycle.controller;

import com.object.lifecycle.dto.ApiResponse;
import com.object.lifecycle.dto.CreateRuleRequest;
import com.object.lifecycle.entity.AuditLog;
import com.object.lifecycle.entity.ExecutionProof;
import com.object.lifecycle.entity.LifecycleRule;
import com.object.lifecycle.enums.RuleStatus;
import com.object.lifecycle.service.AuditLogService;
import com.object.lifecycle.service.ExecutionProofService;
import com.object.lifecycle.service.LifecycleRuleService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rules")
@RequiredArgsConstructor
public class LifecycleRuleController {

    private final LifecycleRuleService ruleService;
    private final AuditLogService auditLogService;
    private final ExecutionProofService proofService;

    @PostMapping
    public ApiResponse<LifecycleRule> createRule(@Valid @RequestBody CreateRuleRequest request) {
        LifecycleRule rule = ruleService.createRule(request);
        return ApiResponse.success("规则创建成功", rule);
    }

    @GetMapping("/{ruleId}")
    public ApiResponse<LifecycleRule> getRule(@PathVariable String ruleId) {
        LifecycleRule rule = ruleService.getRuleByRuleId(ruleId);
        return ApiResponse.success(rule);
    }

    @GetMapping
    public ApiResponse<List<LifecycleRule>> getAllRules(
            @RequestParam(required = false) RuleStatus status) {
        if (status != null) {
            return ApiResponse.success(ruleService.getRulesByStatus(status));
        }
        return ApiResponse.success(ruleService.getAllRules());
    }

    @PostMapping("/{ruleId}/verify")
    public ApiResponse<LifecycleRule> verifyRule(@PathVariable String ruleId) {
        LifecycleRule rule = ruleService.verifyRule(ruleId);
        return ApiResponse.success("规则校验成功", rule);
    }

    @PostMapping("/{ruleId}/activate")
    public ApiResponse<LifecycleRule> activateRule(@PathVariable String ruleId) {
        LifecycleRule rule = ruleService.activateRule(ruleId);
        return ApiResponse.success("规则激活成功", rule);
    }

    @PostMapping("/{ruleId}/suspend")
    public ApiResponse<LifecycleRule> suspendRule(@PathVariable String ruleId) {
        LifecycleRule rule = ruleService.suspendRule(ruleId);
        return ApiResponse.success("规则暂停成功", rule);
    }

    @PostMapping("/{ruleId}/cancel")
    public ApiResponse<LifecycleRule> cancelRule(@PathVariable String ruleId) {
        LifecycleRule rule = ruleService.cancelRule(ruleId);
        return ApiResponse.success("规则撤销成功", rule);
    }

    @GetMapping("/{ruleId}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(@PathVariable String ruleId) {
        List<AuditLog> logs = auditLogService.getAuditLogs("LifecycleRule", ruleId);
        return ApiResponse.success(logs);
    }

    @GetMapping("/{ruleId}/execution-proofs")
    public ApiResponse<List<ExecutionProof>> getExecutionProofs(@PathVariable String ruleId) {
        List<ExecutionProof> proofs = proofService.getProofsByRuleId(ruleId);
        return ApiResponse.success(proofs);
    }
}
