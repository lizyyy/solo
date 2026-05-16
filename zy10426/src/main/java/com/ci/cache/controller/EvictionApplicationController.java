package com.ci.cache.controller;

import com.ci.cache.dto.*;
import com.ci.cache.model.EvictionApplication;
import com.ci.cache.model.EvictionStatus;
import com.ci.cache.service.EvictionApplicationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/evictions")
public class EvictionApplicationController {

    @Autowired
    private EvictionApplicationService evictionService;

    @Autowired
    private ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<ApiResponse<List<EvictionApplication>>> getAllApplications() {
        return ResponseEntity.ok(ApiResponse.success(evictionService.getAllApplications()));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<EvictionApplication>>> getActiveApplications() {
        return ResponseEntity.ok(ApiResponse.success(evictionService.getActiveApplications()));
    }

    @GetMapping("/{applicationId}")
    public ResponseEntity<ApiResponse<EvictionApplication>> getApplicationById(@PathVariable String applicationId) {
        return evictionService.getApplicationById(applicationId)
                .map(app -> ResponseEntity.ok(ApiResponse.success(app)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/status/{status}")
    public ResponseEntity<ApiResponse<List<EvictionApplication>>> getApplicationsByStatus(@PathVariable EvictionStatus status) {
        return ResponseEntity.ok(ApiResponse.success(evictionService.getApplicationsByStatus(status)));
    }

    @GetMapping("/project/{projectName}")
    public ResponseEntity<ApiResponse<List<EvictionApplication>>> getApplicationsByProject(@PathVariable String projectName) {
        return ResponseEntity.ok(ApiResponse.success(evictionService.getApplicationsByProject(projectName)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EvictionApplication>> createApplication(@RequestBody EvictionRequest request) {
        EvictionApplication application = evictionService.createApplication(request);
        return ResponseEntity.ok(ApiResponse.success("Eviction application created", application));
    }

    @PatchMapping("/{applicationId}/status")
    public ResponseEntity<ApiResponse<EvictionApplication>> updateStatus(
            @PathVariable String applicationId,
            @RequestBody StatusUpdateRequest request) {
        EvictionApplication updated = evictionService.updateStatus(applicationId, request);
        return ResponseEntity.ok(ApiResponse.success("Status updated", updated));
    }

    @PatchMapping("/{applicationId}/correct")
    public ResponseEntity<ApiResponse<EvictionApplication>> applyManualCorrection(
            @PathVariable String applicationId,
            @RequestBody ManualCorrectionRequest request) {
        EvictionApplication updated = evictionService.applyManualCorrection(applicationId, request);
        return ResponseEntity.ok(ApiResponse.success("Correction applied", updated));
    }

    @GetMapping("/{applicationId}/export")
    public ResponseEntity<ApiResponse<Map<String, Object>>> exportApplication(@PathVariable String applicationId) {
        Map<String, Object> export = evictionService.exportApplication(applicationId);
        return ResponseEntity.ok(ApiResponse.success("Export generated", export));
    }

    @GetMapping("/export")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> exportAllApplications() {
        List<Map<String, Object>> exports = evictionService.exportAllApplications();
        return ResponseEntity.ok(ApiResponse.success("Export generated", exports));
    }
}
