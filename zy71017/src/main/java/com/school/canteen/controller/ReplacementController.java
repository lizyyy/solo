package com.school.canteen.controller;

import com.school.canteen.dto.ApiResponse;
import com.school.canteen.dto.ReplacementRequestDto;
import com.school.canteen.dto.ValidationResult;
import com.school.canteen.entity.ParentConfirmation;
import com.school.canteen.entity.ReplacementRequest;
import com.school.canteen.service.ReplacementService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/replacements")
public class ReplacementController {

    private final ReplacementService replacementService;

    @Autowired
    public ReplacementController(ReplacementService replacementService) {
        this.replacementService = replacementService;
    }

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

    public static class ReviewRequest {
        private boolean approved;
        private String notes;
        private String reviewer;

        public boolean isApproved() { return approved; }
        public void setApproved(boolean approved) { this.approved = approved; }
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
        public String getReviewer() { return reviewer; }
        public void setReviewer(String reviewer) { this.reviewer = reviewer; }
    }

    public static class ConfirmationRequest {
        private String status;
        private String comment;
        private String operator;

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getComment() { return comment; }
        public void setComment(String comment) { this.comment = comment; }
        public String getOperator() { return operator; }
        public void setOperator(String operator) { this.operator = operator; }
    }

    public static class RevokeRequest {
        private String reason;
        private String operator;

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public String getOperator() { return operator; }
        public void setOperator(String operator) { this.operator = operator; }
    }
}
