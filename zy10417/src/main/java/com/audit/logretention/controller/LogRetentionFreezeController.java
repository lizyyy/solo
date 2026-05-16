package com.audit.logretention.controller;

import com.audit.logretention.dto.*;
import com.audit.logretention.entity.FreezeOperationHistory;
import com.audit.logretention.entity.LogRetentionFreeze;
import com.audit.logretention.service.LogRetentionFreezeService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/log-retention-freeze")
@RequiredArgsConstructor
public class LogRetentionFreezeController {

    private final LogRetentionFreezeService freezeService;

    @PostMapping
    public ApiResponse<LogRetentionFreeze> create(@Valid @RequestBody FreezeCreateRequest request) {
        return freezeService.createFreeze(request);
    }

    @GetMapping("/{id}")
    public ApiResponse<LogRetentionFreeze> getById(@PathVariable Long id) {
        return freezeService.getById(id);
    }

    @GetMapping("/request/{requestId}")
    public ApiResponse<LogRetentionFreeze> getByRequestId(@PathVariable String requestId) {
        return freezeService.getByRequestId(requestId);
    }

    @PostMapping("/query")
    public ApiResponse<Page<LogRetentionFreeze>> query(@RequestBody FreezeQueryRequest request) {
        return freezeService.query(request);
    }

    @PutMapping("/{id}/status")
    public ApiResponse<LogRetentionFreeze> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody FreezeStatusUpdateRequest request) {
        return freezeService.updateStatus(id, request);
    }

    @GetMapping("/{id}/history")
    public ApiResponse<List<FreezeOperationHistory>> getHistory(@PathVariable Long id) {
        return freezeService.getHistory(id);
    }

    @PutMapping("/{id}/manual-correct")
    public ApiResponse<LogRetentionFreeze> manualCorrect(
            @PathVariable Long id,
            @Valid @RequestBody FreezeManualCorrectionRequest request) {
        return freezeService.manualCorrect(id, request);
    }

    @PostMapping("/export")
    public ApiResponse<List<Map<String, Object>>> exportData(@RequestBody FreezeQueryRequest request) {
        return freezeService.exportData(request);
    }

    @PostMapping("/{id}/report")
    public ApiResponse<String> generateRetentionReport(@PathVariable Long id) {
        return freezeService.generateRetentionReport(id);
    }

    @GetMapping("/merged-time-range")
    public ApiResponse<Map<String, Object>> getMergedTimeRange(@RequestParam String logTopic) {
        return freezeService.getMergedTimeRange(logTopic);
    }
}