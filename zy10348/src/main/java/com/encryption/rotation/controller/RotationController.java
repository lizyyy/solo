package com.encryption.rotation.controller;

import com.encryption.rotation.model.dto.ApiResponse;
import com.encryption.rotation.model.dto.CreateRotationRequest;
import com.encryption.rotation.model.dto.RotationReport;
import com.encryption.rotation.model.entity.FailureRecord;
import com.encryption.rotation.model.entity.ReEncryptionTask;
import com.encryption.rotation.model.entity.RotationBatch;
import com.encryption.rotation.model.entity.VerificationRecord;
import com.encryption.rotation.service.RotationService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rotation")
@RequiredArgsConstructor
public class RotationController {

    private final RotationService rotationService;

    @PostMapping
    public ApiResponse<RotationBatch> create(@Valid @RequestBody CreateRotationRequest request) {
        return ApiResponse.success("创建成功", rotationService.createRotation(request));
    }

    @PostMapping("/{batchId}/start")
    public ApiResponse<RotationBatch> start(@PathVariable String batchId) {
        return ApiResponse.success("启动成功", rotationService.startRotation(batchId));
    }

    @PostMapping("/task/{taskId}/process")
    public ApiResponse<Void> processTask(@PathVariable String taskId,
                                        @RequestParam(defaultValue = "false") boolean simulateFailure) {
        rotationService.processTask(taskId, simulateFailure);
        return ApiResponse.success("处理成功", null);
    }

    @PostMapping("/{batchId}/cancel")
    public ApiResponse<RotationBatch> cancel(@PathVariable String batchId,
                                           @RequestBody(required = false) Map<String, String> body) {
        String reason = body != null ? body.get("reason") : "用户取消";
        return ApiResponse.success("取消成功", rotationService.cancelRotation(batchId, reason));
    }

    @PostMapping("/{batchId}/verify")
    public ApiResponse<RotationBatch> startVerification(@PathVariable String batchId,
                                                       @RequestHeader("X-User-Id") String operator) {
        return ApiResponse.success("开始验证", rotationService.startVerification(batchId, operator));
    }

    @PostMapping("/{batchId}/complete")
    public ApiResponse<RotationBatch> complete(@PathVariable String batchId) {
        return ApiResponse.success("完成", rotationService.completeRotation(batchId));
    }

    @GetMapping("/{batchId}")
    public ApiResponse<RotationBatch> getBatch(@PathVariable String batchId) {
        return ApiResponse.success(rotationService.getBatch(batchId));
    }

    @GetMapping("/{batchId}/report")
    public ApiResponse<RotationReport> getReport(@PathVariable String batchId) {
        return ApiResponse.success(rotationService.generateReport(batchId));
    }

    @GetMapping("/tenant/{tenantId}/history")
    public ApiResponse<List<RotationBatch>> getHistory(@PathVariable String tenantId) {
        return ApiResponse.success(rotationService.getBatchHistory(tenantId));
    }

    @GetMapping("/{batchId}/tasks")
    public ApiResponse<List<ReEncryptionTask>> getTasks(@PathVariable String batchId) {
        return ApiResponse.success(rotationService.getTasks(batchId));
    }

    @GetMapping("/{batchId}/failures")
    public ApiResponse<List<FailureRecord>> getFailures(@PathVariable String batchId) {
        return ApiResponse.success(rotationService.getFailures(batchId));
    }

    @GetMapping("/{batchId}/verifications")
    public ApiResponse<List<VerificationRecord>> getVerifications(@PathVariable String batchId) {
        return ApiResponse.success(rotationService.getVerifications(batchId));
    }
}
