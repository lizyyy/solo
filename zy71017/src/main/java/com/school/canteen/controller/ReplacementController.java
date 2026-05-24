package com.school.canteen.controller;

import com.school.canteen.dto.ApiResponse;
import com.school.canteen.dto.ReplacementRequestDto;
import com.school.canteen.dto.ValidationResult;
import com.school.canteen.entity.ParentConfirmation;
import com.school.canteen.entity.ReplacementRequest;
import com.school.canteen.service.ReplacementService;
import jakarta.validation.Valid;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/replacements")
@RequiredArgsConstructor
public class ReplacementController {

    private final ReplacementService replacementService;

    @PostMapping
    public ApiResponse<ReplacementRequest> create(@Valid @RequestBody ReplacementRequestDto dto) {
        return ApiResponse.success(replacementService.createReplacement(dto));
    }

    @GetMapping("/{id}")
    public ApiResponse<ReplacementRequest> getById(@PathVariable Long id) {
        return ApiResponse.success(replacementService.getReplacement(id));
    }

    @GetMapping
    public ApiResponse<List<ReplacementRequest>> getAll() {
        return ApiResponse.success(replacementService.getAllReplacements());
    }

    @PostMapping("/{id}/validate")
    public ApiResponse<ValidationResult> validate(@PathVariable Long id) {
        ValidationResult result = replacementService.validateReplacement(id);
        replacementService.processValidation(id, result);
        return ApiResponse.success("校验完成", result);
    }

    @PostMapping("/{id}/review")
    public ApiResponse<ReplacementRequest> review(
            @PathVariable Long id,
            @RequestBody ReviewRequest request) {
        return ApiResponse.success(replacementService.reviewReplacement(
            id, request.isApproved(), request.getNotes(), request.getReviewer()));
    }

    @PostMapping("/{id}/start-confirmation")
    public ApiResponse<ReplacementRequest> startConfirmation(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ApiResponse.success(replacementService.startConfirmation(id, operator));
    }

    @PostMapping("/{id}/confirmations/{studentId}")
    public ApiResponse<ParentConfirmation> submitConfirmation(
            @PathVariable Long id,
            @PathVariable Long studentId,
            @RequestBody ConfirmationRequest request) {
        return ApiResponse.success(replacementService.submitConfirmation(
            id, studentId, request.getStatus(), request.getComment(), request.getOperator()));
    }

    @GetMapping("/{id}/confirmations")
    public ApiResponse<List<ParentConfirmation>> getConfirmations(@PathVariable Long id) {
        return ApiResponse.success(replacementService.getConfirmations(id));
    }

    @PostMapping("/{id}/complete")
    public ApiResponse<ReplacementRequest> complete(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ApiResponse.success(replacementService.completeReplacement(id, operator));
    }

    @PostMapping("/{id}/revoke")
    public ApiResponse<ReplacementRequest> revoke(
            @PathVariable Long id,
            @RequestBody RevokeRequest request) {
        return ApiResponse.success(replacementService.revokeReplacement(
            id, request.getReason(), request.getOperator()));
    }

    @PostMapping("/{id}/lock")
    public ApiResponse<ReplacementRequest> lock(
            @PathVariable Long id,
            @RequestParam(required = false, defaultValue = "system") String operator) {
        return ApiResponse.success(replacementService.lockReplacement(id, operator));
    }

    @Data
    public static class ReviewRequest {
        private boolean approved;
        private String notes;
        private String reviewer;
    }

    @Data
    public static class ConfirmationRequest {
        private String status;
        private String comment;
        private String operator;
    }

    @Data
    public static class RevokeRequest {
        private String reason;
        private String operator;
    }
}
