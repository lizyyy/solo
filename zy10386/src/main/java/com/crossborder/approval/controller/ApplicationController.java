package com.crossborder.approval.controller;

import com.crossborder.approval.model.dto.ApiResponse;
import com.crossborder.approval.model.dto.ApprovalRequest;
import com.crossborder.approval.model.dto.CreateApplicationRequest;
import com.crossborder.approval.model.entity.AccessToken;
import com.crossborder.approval.model.entity.ApprovalChain;
import com.crossborder.approval.model.entity.AuditLog;
import com.crossborder.approval.model.entity.DataAccessApplication;
import com.crossborder.approval.model.entity.EvidenceRecord;
import com.crossborder.approval.model.enums.ApplicationStatus;
import com.crossborder.approval.model.enums.RegionType;
import com.crossborder.approval.repository.AuditLogRepository;
import com.crossborder.approval.service.*;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    private final ApplicationService applicationService;
    private final ApprovalService approvalService;
    private final TokenService tokenService;
    private final EvidenceService evidenceService;
    private final ExportService exportService;
    private final AuditLogRepository auditLogRepository;

    @PostMapping
    public ApiResponse<DataAccessApplication> createApplication(
            @Valid @RequestBody CreateApplicationRequest request) {
        DataAccessApplication application = applicationService.createApplication(request);
        return ApiResponse.success("申请创建成功", application);
    }

    @GetMapping("/{applicationId}")
    public ApiResponse<DataAccessApplication> getApplication(@PathVariable Long applicationId) {
        DataAccessApplication application = applicationService.getApplication(applicationId);
        return ApiResponse.success(application);
    }

    @GetMapping("/no/{applicationNo}")
    public ApiResponse<DataAccessApplication> getApplicationByNo(@PathVariable String applicationNo) {
        DataAccessApplication application = applicationService.getApplicationByNo(applicationNo);
        return ApiResponse.success(application);
    }

    @GetMapping("/applicant/{applicantId}")
    public ApiResponse<List<DataAccessApplication>> getApplicationsByApplicant(
            @PathVariable String applicantId) {
        List<DataAccessApplication> applications = applicationService.getApplicationsByApplicant(applicantId);
        return ApiResponse.success(applications);
    }

    @GetMapping("/status/{status}")
    public ApiResponse<List<DataAccessApplication>> getApplicationsByStatus(
            @PathVariable ApplicationStatus status) {
        List<DataAccessApplication> applications = applicationService.getApplicationsByStatus(status);
        return ApiResponse.success(applications);
    }

    @PostMapping("/{applicationId}/submit-region-validation")
    public ApiResponse<DataAccessApplication> submitForRegionValidation(
            @PathVariable Long applicationId,
            @RequestParam String operatorId,
            @RequestParam String operatorName) {
        DataAccessApplication application = applicationService.submitForRegionValidation(
                applicationId, operatorId, operatorName);
        return ApiResponse.success("已提交地区校验", application);
    }

    @PostMapping("/{applicationId}/validate-region")
    public ApiResponse<DataAccessApplication> validateRegion(
            @PathVariable Long applicationId,
            @RequestParam boolean approved,
            @RequestParam(required = false) String rejectReason,
            @RequestParam String operatorId,
            @RequestParam String operatorName) {
        DataAccessApplication application = applicationService.validateRegion(
                applicationId, approved, rejectReason, operatorId, operatorName);
        return ApiResponse.success(approved ? "地区校验通过" : "地区校验被拒绝", application);
    }

    @PostMapping("/{applicationId}/submit-approval")
    public ApiResponse<DataAccessApplication> submitForApproval(
            @PathVariable Long applicationId,
            @RequestParam String operatorId,
            @RequestParam String operatorName) {
        DataAccessApplication application = applicationService.submitForApproval(
                applicationId, operatorId, operatorName);
        return ApiResponse.success("已提交审批", application);
    }

    @PostMapping("/{applicationId}/approve")
    public ApiResponse<DataAccessApplication> approve(
            @PathVariable Long applicationId,
            @Valid @RequestBody ApprovalRequest request) {
        DataAccessApplication application = approvalService.approve(applicationId, request);
        return ApiResponse.success("审批完成", application);
    }

    @GetMapping("/{applicationId}/approval-history")
    public ApiResponse<List<ApprovalChain>> getApprovalHistory(@PathVariable Long applicationId) {
        List<ApprovalChain> history = approvalService.getApprovalHistory(applicationId);
        return ApiResponse.success(history);
    }

    @PostMapping("/{applicationId}/issue-token")
    public ApiResponse<AccessToken> issueToken(
            @PathVariable Long applicationId,
            @RequestParam String operatorId,
            @RequestParam String operatorName) {
        AccessToken token = tokenService.issueToken(applicationId, operatorId, operatorName);
        return ApiResponse.success("令牌签发成功", token);
    }

    @GetMapping("/{applicationId}/token")
    public ApiResponse<AccessToken> getToken(@PathVariable Long applicationId) {
        AccessToken token = tokenService.getTokenByApplication(applicationId);
        return ApiResponse.success(token);
    }

    @PostMapping("/token/validate")
    public ApiResponse<Boolean> validateToken(@RequestParam String token) {
        boolean valid = tokenService.validateToken(token);
        return ApiResponse.success(valid ? "令牌有效" : "令牌无效", valid);
    }

    @PostMapping("/token/{tokenId}/revoke")
    public ApiResponse<Void> revokeToken(
            @PathVariable Long tokenId,
            @RequestParam String reason,
            @RequestParam String operatorId,
            @RequestParam String operatorName) {
        tokenService.revokeToken(tokenId, reason, operatorId, operatorName);
        return ApiResponse.success("令牌已吊销", null);
    }

    @GetMapping("/{applicationId}/audit-logs")
    public ApiResponse<List<AuditLog>> getAuditLogs(@PathVariable Long applicationId) {
        List<AuditLog> logs = auditLogRepository.findByApplicationIdOrderByTimestampDesc(applicationId);
        return ApiResponse.success(logs);
    }

    @GetMapping("/{applicationId}/evidence")
    public ApiResponse<List<EvidenceRecord>> getEvidence(@PathVariable Long applicationId) {
        List<EvidenceRecord> evidence = evidenceService.getEvidenceByApplication(applicationId);
        return ApiResponse.success(evidence);
    }

    @GetMapping("/{applicationNo}/export-report")
    public ResponseEntity<String> exportReport(@PathVariable String applicationNo) {
        String report = exportService.exportTroubleshootingReport(applicationNo);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.TEXT_PLAIN);
        headers.setContentDispositionFormData("attachment", "report-" + applicationNo + ".txt");
        return ResponseEntity.ok().headers(headers).body(report);
    }

    @GetMapping("/restricted-regions")
    public ApiResponse<List<RegionType>> getRestrictedRegions() {
        List<RegionType> regions = applicationService.getRestrictedRegions();
        return ApiResponse.success(regions);
    }

    @GetMapping("/statuses")
    public ApiResponse<List<ApplicationStatus>> getAllStatuses() {
        return ApiResponse.success(List.of(ApplicationStatus.values()));
    }

    @GetMapping("/regions")
    public ApiResponse<List<RegionType>> getAllRegions() {
        return ApiResponse.success(List.of(RegionType.values()));
    }
}
