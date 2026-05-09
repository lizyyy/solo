package com.mold.service.controller;

import com.mold.service.common.ApiResponse;
import com.mold.service.domain.entity.MoldExtensionApproval;
import com.mold.service.domain.repository.MoldExtensionApprovalRepository;
import com.mold.service.service.MoldExtensionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mold-extensions")
@RequiredArgsConstructor
public class MoldExtensionController {
    
    private final MoldExtensionService extensionService;
    private final MoldExtensionApprovalRepository approvalRepository;
    
    @PostMapping("/request")
    public ApiResponse<MoldExtensionApproval> requestExtension(
            @RequestBody ExtensionRequest request,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        return ApiResponse.success(extensionService.requestExtension(
                request.getMoldCode(),
                request.getExtensionStrokes(),
                request.getReason(),
                request.getProductionLine(),
                request.getProductCode(),
                operator
        ));
    }
    
    @GetMapping
    public ApiResponse<List<MoldExtensionApproval>> getAllApprovals(
            @RequestParam(required = false) List<MoldExtensionApproval.ApprovalStatus> statuses) {
        List<MoldExtensionApproval> approvals = statuses != null && !statuses.isEmpty()
                ? approvalRepository.findByStatusIn(statuses)
                : approvalRepository.findAll();
        return ApiResponse.success(approvals);
    }
    
    @GetMapping("/pending")
    public ApiResponse<List<MoldExtensionApproval>> getPendingApprovals() {
        return ApiResponse.success(approvalRepository.findByStatusIn(
                List.of(MoldExtensionApproval.ApprovalStatus.PENDING)));
    }
    
    @GetMapping("/{approvalNo}")
    public ApiResponse<MoldExtensionApproval> getByApprovalNo(@PathVariable String approvalNo) {
        return approvalRepository.findByApprovalNo(approvalNo)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "审批不存在: " + approvalNo));
    }
    
    @PostMapping("/{approvalNo}/approve")
    public ApiResponse<MoldExtensionApproval> approveExtension(
            @PathVariable String approvalNo,
            @RequestBody ApprovalAction request,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        return ApiResponse.success(extensionService.approveExtension(
                approvalNo,
                request.getRemark(),
                operator
        ));
    }
    
    @PostMapping("/{approvalNo}/reject")
    public ApiResponse<MoldExtensionApproval> rejectExtension(
            @PathVariable String approvalNo,
            @RequestBody ApprovalAction request,
            @RequestHeader(value = "X-Operator", defaultValue = "system") String operator) {
        return ApiResponse.success(extensionService.rejectExtension(
                approvalNo,
                request.getRemark(),
                operator
        ));
    }
    
    @Data
    public static class ExtensionRequest {
        private String moldCode;
        private Long extensionStrokes;
        private String reason;
        private String productionLine;
        private String productCode;
    }
    
    @Data
    public static class ApprovalAction {
        private String remark;
    }
}
