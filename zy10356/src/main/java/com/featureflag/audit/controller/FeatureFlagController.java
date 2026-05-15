package com.featureflag.audit.controller;

import com.featureflag.audit.dto.EvaluateRequest;
import com.featureflag.audit.dto.EvaluateResponse;
import com.featureflag.audit.entity.AuditRecord;
import com.featureflag.audit.service.AuditService;
import com.featureflag.audit.service.FeatureFlagService;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/feature-flag")
@RequiredArgsConstructor
public class FeatureFlagController {
    private final FeatureFlagService featureFlagService;
    private final AuditService auditService;

    @PostMapping("/evaluate")
    public ResponseEntity<EvaluateResponse> evaluate(@Valid @RequestBody EvaluateRequest request) {
        log.info("评估特征开关: requestId={}, experimentKey={}, userIdentifier={}",
                request.getRequestId(), request.getExperimentKey(), request.getUserIdentifier());
        EvaluateResponse response = featureFlagService.evaluate(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/audit/{id}/compensate")
    public ResponseEntity<AuditRecord> compensate(@PathVariable Long id,
                                                  @RequestParam String compensatedBy) {
        log.info("补偿审计记录: id={}, compensatedBy={}", id, compensatedBy);
        AuditRecord record = featureFlagService.compensate(id, compensatedBy);
        return ResponseEntity.ok(record);
    }

    @GetMapping("/audit/failed")
    public ResponseEntity<List<AuditRecord>> getFailedRecords() {
        List<AuditRecord> records = featureFlagService.getFailedRecords();
        return ResponseEntity.ok(records);
    }

    @GetMapping("/audit")
    public ResponseEntity<Page<AuditRecord>> getAuditRecords(
            @RequestParam(required = false) String experimentKey,
            @RequestParam(required = false) String userIdentifier,
            @RequestParam(required = false) AuditRecord.AuditStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<AuditRecord> records = auditService.getAuditRecords(
                experimentKey, userIdentifier, status, startTime, endTime, page, size);
        return ResponseEntity.ok(records);
    }

    @GetMapping("/audit/{id}")
    public ResponseEntity<AuditRecord> getAuditRecordById(@PathVariable Long id) {
        AuditRecord record = auditService.getAuditRecordById(id);
        if (record == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(record);
    }

    @GetMapping("/audit/request/{requestId}")
    public ResponseEntity<AuditRecord> getAuditRecordByRequestId(@PathVariable String requestId) {
        AuditRecord record = auditService.getAuditRecordByRequestId(requestId);
        if (record == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(record);
    }

    @GetMapping("/audit/recent")
    public ResponseEntity<List<AuditRecord>> getRecentUserHits(
            @RequestParam String experimentKey,
            @RequestParam String userIdentifier,
            @RequestParam(defaultValue = "10") int limit) {
        List<AuditRecord> records = auditService.getRecentUserHits(experimentKey, userIdentifier, limit);
        return ResponseEntity.ok(records);
    }

    @GetMapping("/audit/export")
    public ResponseEntity<byte[]> exportAuditRecords(
            @RequestParam(required = false) String experimentKey,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        byte[] csvData = auditService.exportAuditRecords(experimentKey, startTime, endTime);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("text/csv; charset=UTF-8"));
        headers.setContentDispositionFormData("attachment", "audit-records.csv");
        headers.setContentLength(csvData.length);

        return ResponseEntity.ok()
                .headers(headers)
                .body(csvData);
    }
}
