package com.schema.approval.controller;

import com.schema.approval.dto.*;
import com.schema.approval.entity.ApprovalRecord;
import com.schema.approval.entity.CompatibilityCheck;
import com.schema.approval.entity.ConsumerNotification;
import com.schema.approval.entity.PublishRecord;
import com.schema.approval.entity.SchemaVersion;
import com.schema.approval.service.SchemaApprovalService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/schemas")
@RequiredArgsConstructor
public class SchemaApprovalController {
    private final SchemaApprovalService schemaApprovalService;

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<SchemaVersion>> registerSchema(
            @Valid @RequestBody SchemaRegisterRequest request) {
        SchemaVersion schemaVersion = schemaApprovalService.registerSchema(request);
        return ResponseEntity.ok(ApiResponse.success("Schema registered successfully", schemaVersion));
    }

    @PostMapping("/{schemaVersionId}/compatibility-check")
    public ResponseEntity<ApiResponse<SchemaVersion>> triggerCompatibilityCheck(
            @PathVariable Long schemaVersionId,
            @RequestBody Map<String, String> body) {
        String operator = body.get("operator");
        SchemaVersion schemaVersion = schemaApprovalService.triggerCompatibilityCheck(schemaVersionId, operator);
        return ResponseEntity.ok(ApiResponse.success("Compatibility check completed", schemaVersion));
    }

    @PostMapping("/{schemaVersionId}/submit-approval")
    public ResponseEntity<ApiResponse<SchemaVersion>> submitForApproval(
            @PathVariable Long schemaVersionId,
            @RequestBody Map<String, String> body) {
        String operator = body.get("operator");
        SchemaVersion schemaVersion = schemaApprovalService.submitForApproval(schemaVersionId, operator);
        return ResponseEntity.ok(ApiResponse.success("Schema submitted for approval", schemaVersion));
    }

    @PostMapping("/approve")
    public ResponseEntity<ApiResponse<SchemaVersion>> processApproval(
            @Valid @RequestBody ApprovalRequest request) {
        SchemaVersion schemaVersion = schemaApprovalService.processApproval(request);
        return ResponseEntity.ok(ApiResponse.success("Approval processed", schemaVersion));
    }

    @PostMapping("/{schemaVersionId}/publish")
    public ResponseEntity<ApiResponse<SchemaVersion>> publishSchema(
            @PathVariable Long schemaVersionId,
            @RequestBody Map<String, String> body) {
        String operator = body.get("operator");
        SchemaVersion schemaVersion = schemaApprovalService.publishSchema(schemaVersionId, operator);
        return ResponseEntity.ok(ApiResponse.success("Schema published successfully", schemaVersion));
    }

    @GetMapping("/topic/{topicName}")
    public ResponseEntity<ApiResponse<List<SchemaVersion>>> getSchemaVersionsByTopic(
            @PathVariable String topicName) {
        List<SchemaVersion> versions = schemaApprovalService.getSchemaVersionsByTopic(topicName);
        return ResponseEntity.ok(ApiResponse.success(versions));
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<ApiResponse<SchemaVersion>> getSchemaByRequestId(
            @PathVariable String requestId) {
        return schemaApprovalService.getSchemaVersionByRequestId(requestId)
                .map(schema -> ResponseEntity.ok(ApiResponse.success(schema)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{schemaVersionId}")
    public ResponseEntity<ApiResponse<SchemaVersion>> getSchemaVersion(@PathVariable Long schemaVersionId) {
        SchemaVersion schemaVersion = schemaApprovalService.getSchemaVersionOrThrow(schemaVersionId);
        return ResponseEntity.ok(ApiResponse.success(schemaVersion));
    }

    @GetMapping("/{schemaVersionId}/compatibility-history")
    public ResponseEntity<ApiResponse<List<CompatibilityCheck>>> getCompatibilityCheckHistory(
            @PathVariable Long schemaVersionId) {
        List<CompatibilityCheck> history = schemaApprovalService.getCompatibilityCheckHistory(schemaVersionId);
        return ResponseEntity.ok(ApiResponse.success(history));
    }

    @GetMapping("/{schemaVersionId}/approval-history")
    public ResponseEntity<ApiResponse<List<ApprovalRecord>>> getApprovalHistory(
            @PathVariable Long schemaVersionId) {
        List<ApprovalRecord> history = schemaApprovalService.getApprovalHistory(schemaVersionId);
        return ResponseEntity.ok(ApiResponse.success(history));
    }

    @GetMapping("/{schemaVersionId}/publish-history")
    public ResponseEntity<ApiResponse<List<PublishRecord>>> getPublishHistory(
            @PathVariable Long schemaVersionId) {
        List<PublishRecord> history = schemaApprovalService.getPublishHistory(schemaVersionId);
        return ResponseEntity.ok(ApiResponse.success(history));
    }

    @GetMapping("/{schemaVersionId}/notification-history")
    public ResponseEntity<ApiResponse<List<ConsumerNotification>>> getConsumerNotificationHistory(
            @PathVariable Long schemaVersionId) {
        List<ConsumerNotification> history = schemaApprovalService.getConsumerNotificationHistory(schemaVersionId);
        return ResponseEntity.ok(ApiResponse.success(history));
    }
}
