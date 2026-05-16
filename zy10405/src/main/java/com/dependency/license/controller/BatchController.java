package com.dependency.license.controller;

import com.dependency.license.dto.*;
import com.dependency.license.model.*;
import com.dependency.license.service.BatchService;
import com.dependency.license.service.ExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/batches")
@RequiredArgsConstructor
@Tag(name = "升级批次管理", description = "依赖升级批次的创建、审批、执行管理")
public class BatchController {
    private final BatchService batchService;
    private final ExportService exportService;

    @PostMapping
    @Operation(summary = "创建批次", description = "创建一个新的依赖升级批次")
    public ApiResponse<UpgradeBatch> createBatch(@Valid @RequestBody CreateBatchRequest request) {
        return ApiResponse.success(batchService.createBatch(request));
    }

    @GetMapping
    @Operation(summary = "获取所有批次", description = "查询所有升级批次列表")
    public ApiResponse<List<UpgradeBatch>> getAllBatches() {
        return ApiResponse.success(batchService.getAllBatches());
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取批次详情", description = "根据ID获取批次详细信息")
    public ApiResponse<UpgradeBatch> getBatchById(@PathVariable Long id) {
        return ApiResponse.success(batchService.getBatchById(id));
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "提交审批", description = "将批次提交审批")
    public ApiResponse<UpgradeBatch> submitForApproval(@PathVariable Long id) {
        return ApiResponse.success(batchService.submitForApproval(id));
    }

    @GetMapping("/{id}/approvals")
    @Operation(summary = "获取审批列表", description = "获取批次的所有仓库审批记录")
    public ApiResponse<List<RepositoryApproval>> getApprovals(@PathVariable Long id) {
        return ApiResponse.success(batchService.getApprovalsByBatch(id));
    }

    @PostMapping("/approvals/{approvalId}/approve")
    @Operation(summary = "审批", description = "对仓库升级申请进行审批")
    public ApiResponse<RepositoryApproval> approve(@PathVariable Long approvalId,
                                                   @Valid @RequestBody ApprovalRequest request) {
        return ApiResponse.success(batchService.approve(approvalId, request));
    }

    @PostMapping("/approvals/{approvalId}/defer")
    @Operation(summary = "申请延期", description = "对仓库升级申请提出延期申请")
    public ApiResponse<DeferralRequest> requestDeferral(@PathVariable Long approvalId,
                                                     @Valid @RequestBody DeferralRequestDto request) {
        return ApiResponse.success(batchService.requestDeferral(approvalId, request));
    }

    @GetMapping("/{id}/deferrals")
    @Operation(summary = "获取延期列表", description = "获取批次的所有延期申请记录")
    public ApiResponse<List<DeferralRequest>> getDeferrals(@PathVariable Long id) {
        return ApiResponse.success(batchService.getDeferralsByBatch(id));
    }

    @PostMapping("/{id}/start")
    @Operation(summary = "开始升级", description = "正式开始批次的依赖升级")
    public ApiResponse<UpgradeBatch> startUpgrade(@PathVariable Long id) {
        return ApiResponse.success(batchService.startUpgrade(id));
    }

    @PostMapping("/{id}/complete")
    @Operation(summary = "完成升级", description = "标记批次升级完成")
    public ApiResponse<UpgradeBatch> completeBatch(@PathVariable Long id) {
        return ApiResponse.success(batchService.completeBatch(id));
    }

    @PostMapping("/approvals/{approvalId}/correct")
    @Operation(summary = "人工修正", description = "人工修正审批状态")
    public ApiResponse<RepositoryApproval> manualCorrect(@PathVariable Long approvalId,
                                                          @RequestParam ApprovalStatus newStatus,
                                                          @RequestParam String operator,
                                                          @RequestParam String reason) {
        return ApiResponse.success(batchService.manualCorrect(approvalId, newStatus, operator, reason));
    }

    @GetMapping("/{id}/export")
    @Operation(summary = "导出许可清单", description = "导出批次的许可清单CSV文件")
    public ResponseEntity<byte[]> exportLicenseList(@PathVariable Long id) {
        byte[] data = exportService.exportLicenseList(id);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "license-list-" + id + ".csv");
        return ResponseEntity.ok().headers(headers).body(data);
    }
}