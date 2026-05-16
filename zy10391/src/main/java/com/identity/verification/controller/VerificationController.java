package com.identity.verification.controller;

import com.identity.verification.dto.*;
import com.identity.verification.model.VerificationHistory;
import com.identity.verification.model.VerificationTask;
import com.identity.verification.service.VerificationService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/verification")
@RequiredArgsConstructor
public class VerificationController {

    private final VerificationService verificationService;

    @PostMapping
    public ResponseEntity<ApiResponse<VerificationResult>> createVerification(
            @Valid @RequestBody CreateVerificationRequest request) {
        return verificationService.createVerification(request);
    }

    @GetMapping("/{taskId}")
    public ResponseEntity<ApiResponse<VerificationResult>> getVerification(@PathVariable Long taskId) {
        return verificationService.getVerification(taskId);
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<ApiResponse<VerificationResult>> getVerificationByRequestId(@PathVariable String requestId) {
        return verificationService.getVerificationByRequestId(requestId);
    }

    @PostMapping("/{taskId}/advance")
    public ResponseEntity<ApiResponse<VerificationResult>> advanceVerification(
            @PathVariable Long taskId,
            @Valid @RequestBody AdvanceRequest request) {
        return verificationService.advanceVerification(taskId, request);
    }

    @PostMapping("/{taskId}/revoke")
    public ResponseEntity<ApiResponse<VerificationResult>> revokeVerification(
            @PathVariable Long taskId,
            @RequestParam(defaultValue = "人工撤销") String reason) {
        return verificationService.revokeVerification(taskId, reason);
    }

    @GetMapping("/list")
    public ResponseEntity<ApiResponse<List<VerificationTask>>> listTasks(
            @RequestParam(required = false) String status) {
        return verificationService.listTasks(status);
    }

    @GetMapping("/{taskId}/history")
    public ResponseEntity<ApiResponse<List<VerificationHistory>>> getHistory(@PathVariable Long taskId) {
        return verificationService.getHistory(taskId);
    }
}
