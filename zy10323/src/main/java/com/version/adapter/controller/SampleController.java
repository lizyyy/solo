package com.version.adapter.controller;

import com.version.adapter.entity.InvocationSample;
import com.version.adapter.service.ResponseAdapterService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/samples")
@RequiredArgsConstructor
@Slf4j
public class SampleController {

    private final ResponseAdapterService responseAdapterService;

    @GetMapping
    public ResponseEntity<List<InvocationSample>> getAllSamples(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        List<InvocationSample> samples = responseAdapterService.getInvocationHistory(startTime, endTime);
        return ResponseEntity.ok(samples);
    }

    @GetMapping("/request/{requestId}")
    public ResponseEntity<InvocationSample> getSampleByRequestId(@PathVariable String requestId) {
        InvocationSample sample = responseAdapterService.getInvocationByRequestId(requestId);
        if (sample == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(sample);
    }

    @GetMapping("/version/{versionId}")
    public ResponseEntity<List<InvocationSample>> getSamplesByVersion(@PathVariable Long versionId) {
        List<InvocationSample> samples = responseAdapterService.getInvocationByVersion(versionId);
        return ResponseEntity.ok(samples);
    }

    @GetMapping("/errors")
    public ResponseEntity<List<InvocationSample>> getErrorSamples() {
        List<InvocationSample> samples = responseAdapterService.getErrorInvocations();
        return ResponseEntity.ok(samples);
    }

    @GetMapping("/warnings")
    public ResponseEntity<List<InvocationSample>> getWarningSamples() {
        List<InvocationSample> samples = responseAdapterService.getWarningInvocations();
        return ResponseEntity.ok(samples);
    }

    @GetMapping("/troubleshooting-summary")
    public ResponseEntity<Map<String, Object>> exportTroubleshootingSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startTime,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endTime) {
        Map<String, Object> summary = responseAdapterService.exportTroubleshootingSummary(startTime, endTime);
        return ResponseEntity.ok(summary);
    }
}
