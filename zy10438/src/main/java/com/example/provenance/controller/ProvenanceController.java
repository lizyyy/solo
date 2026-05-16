package com.example.provenance.controller;

import com.example.provenance.dto.*;
import com.example.provenance.model.ProvenanceRecord;
import com.example.provenance.model.ProvenanceStatus;
import com.example.provenance.service.ProvenanceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import javax.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/v1/provenance")
@RequiredArgsConstructor
public class ProvenanceController {

    private final ProvenanceService provenanceService;

    @PostMapping
    public ResponseEntity<ProvenanceRecord> submitProvenance(@Valid @RequestBody ProvenanceSubmitRequest request) {
        log.info("提交来源证明: {}", request.getImageTag());
        ProvenanceRecord record = provenanceService.submitProvenance(request);
        return ResponseEntity.ok(record);
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProvenanceRecord> getById(@PathVariable String id) {
        return provenanceService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/tag/{imageTag}")
    public ResponseEntity<ProvenanceRecord> getByImageTag(@PathVariable String imageTag) {
        return provenanceService.getByImageTag(imageTag)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    public ResponseEntity<List<ProvenanceRecord>> getAll(
            @RequestParam(required = false) ProvenanceStatus status) {
        List<ProvenanceRecord> records;
        if (status != null) {
            records = provenanceService.getByStatus(status);
        } else {
            records = provenanceService.getAll();
        }
        return ResponseEntity.ok(records);
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<ProvenanceRecord> updateStatus(
            @PathVariable String id,
            @Valid @RequestBody StatusUpdateRequest request) {
        return provenanceService.updateStatus(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/exception/approve")
    public ResponseEntity<ProvenanceRecord> approveException(
            @PathVariable String id,
            @Valid @RequestBody ExceptionApprovalRequest request) {
        return provenanceService.approveException(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/correct")
    public ResponseEntity<ProvenanceRecord> manualCorrect(
            @PathVariable String id,
            @RequestBody ManualCorrectionRequest request) {
        return provenanceService.manualCorrect(id, request)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/export")
    public ResponseEntity<String> exportProvenance(@PathVariable String id) throws JsonProcessingException {
        String packageJson = provenanceService.exportProvenancePackage(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=provenance-" + id + ".json")
                .contentType(MediaType.APPLICATION_JSON)
                .body(packageJson);
    }

    @PostMapping("/init-sample")
    public ResponseEntity<String> initSampleData() {
        provenanceService.initSampleData();
        return ResponseEntity.ok("样例数据初始化完成");
    }
}
