package com.privacy.export.controller;

import com.privacy.export.dto.*;
import com.privacy.export.entity.*;
import com.privacy.export.enums.ExportRequestStatus;
import com.privacy.export.service.ExportRequestService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/export-requests")
@RequiredArgsConstructor
public class ExportRequestController {

    private final ExportRequestService exportRequestService;

    @PostMapping
    public ApiResponse<ExportRequest> createExportRequest(@Valid @RequestBody CreateExportRequest request) {
        log.info("Received create export request for user: {}", request.getUserId());
        ExportRequest result = exportRequestService.createExportRequest(request);
        return ApiResponse.success(result);
    }

    @GetMapping("/{requestNo}")
    public ApiResponse<ExportRequest> getExportRequest(@PathVariable String requestNo) {
        log.info("Received get export request for requestNo: {}", requestNo);
        ExportRequest result = exportRequestService.getExportRequest(requestNo);
        return ApiResponse.success(result);
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<List<ExportRequest>> getExportRequestsByUser(@PathVariable String userId) {
        log.info("Received get export requests for user: {}", userId);
        List<ExportRequest> result = exportRequestService.getExportRequestsByUser(userId);
        return ApiResponse.success(result);
    }

    @GetMapping("/status/{status}")
    public ApiResponse<List<ExportRequest>> getExportRequestsByStatus(@PathVariable ExportRequestStatus status) {
        log.info("Received get export requests for status: {}", status);
        List<ExportRequest> result = exportRequestService.getExportRequestsByStatus(status);
        return ApiResponse.success(result);
    }

    @PostMapping("/{requestNo}/transition")
    public ApiResponse<ExportRequest> transitionStatus(
            @PathVariable String requestNo,
            @Valid @RequestBody StatusTransitionRequest request) {
        log.info("Received status transition for requestNo: {} to {}", requestNo, request.getTargetStatus());
        ExportRequest result = exportRequestService.transitionStatus(requestNo, request);
        return ApiResponse.success(result);
    }

    @PostMapping("/{requestNo}/manual-correction")
    public ApiResponse<ExportRequest> applyManualCorrection(
            @PathVariable String requestNo,
            @Valid @RequestBody ManualCorrectionRequest request) {
        log.info("Received manual correction for requestNo: {}", requestNo);
        ExportRequest result = exportRequestService.applyManualCorrection(requestNo, request);
        return ApiResponse.success(result);
    }

    @GetMapping("/{requestNo}/approval-nodes")
    public ApiResponse<List<ApprovalNode>> getApprovalNodes(@PathVariable String requestNo) {
        log.info("Received get approval nodes for requestNo: {}", requestNo);
        List<ApprovalNode> result = exportRequestService.getApprovalNodes(requestNo);
        return ApiResponse.success(result);
    }

    @GetMapping("/{requestNo}/scope-items")
    public ApiResponse<List<ExportScopeItem>> getScopeItems(@PathVariable String requestNo) {
        log.info("Received get scope items for requestNo: {}", requestNo);
        List<ExportScopeItem> result = exportRequestService.getScopeItems(requestNo);
        return ApiResponse.success(result);
    }

    @GetMapping("/{requestNo}/packaging-task")
    public ApiResponse<PackagingTask> getPackagingTask(@PathVariable String requestNo) {
        log.info("Received get packaging task for requestNo: {}", requestNo);
        PackagingTask result = exportRequestService.getPackagingTask(requestNo);
        return ApiResponse.success(result);
    }

    @GetMapping("/{requestNo}/delivery-record")
    public ApiResponse<DeliveryRecord> getDeliveryRecord(@PathVariable String requestNo) {
        log.info("Received get delivery record for requestNo: {}", requestNo);
        DeliveryRecord result = exportRequestService.getDeliveryRecord(requestNo);
        return ApiResponse.success(result);
    }
}
