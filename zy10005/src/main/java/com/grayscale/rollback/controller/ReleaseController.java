package com.grayscale.rollback.controller;

import com.grayscale.rollback.dto.CreateReleaseRequest;
import com.grayscale.rollback.dto.RollbackRequest;
import com.grayscale.rollback.entity.OperationLog;
import com.grayscale.rollback.entity.Release;
import com.grayscale.rollback.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/releases")
public class ReleaseController {
    
    private final ReleaseService releaseService;
    private final OperationLogService logService;
    private final ErrorReplayService replayService;
    private final RecoveryService recoveryService;
    private final ReportService reportService;
    
    public ReleaseController(ReleaseService releaseService,
                            OperationLogService logService,
                            ErrorReplayService replayService,
                            RecoveryService recoveryService,
                            ReportService reportService) {
        this.releaseService = releaseService;
        this.logService = logService;
        this.replayService = replayService;
        this.recoveryService = recoveryService;
        this.reportService = reportService;
    }
    
    @PostMapping
    public ResponseEntity<Release> createRelease(@RequestBody CreateReleaseRequest request) {
        Release release = releaseService.createRelease(
            request.getServiceName(),
            request.getCurrentVersion(),
            request.getTargetVersion(),
            request.getTotalInstances(),
            request.getMetadata()
        );
        return ResponseEntity.ok(release);
    }
    
    @GetMapping("/{releaseId}")
    public ResponseEntity<Release> getRelease(@PathVariable String releaseId) {
        Optional<Release> release = releaseService.getRelease(releaseId);
        return release.map(ResponseEntity::ok)
                     .orElseGet(() -> ResponseEntity.notFound().build());
    }
    
    @GetMapping
    public ResponseEntity<List<Release>> getActiveReleases() {
        return ResponseEntity.ok(releaseService.getActiveReleases());
    }
    
    @PostMapping("/{releaseId}/start")
    public ResponseEntity<Release> startRelease(@PathVariable String releaseId) {
        return ResponseEntity.ok(releaseService.startRelease(releaseId));
    }
    
    @PostMapping("/{releaseId}/advance")
    public ResponseEntity<Release> advanceCanary(@PathVariable String releaseId) {
        return ResponseEntity.ok(releaseService.advanceCanary(releaseId));
    }
    
    @PostMapping("/{releaseId}/rollback")
    public ResponseEntity<Release> triggerRollback(@PathVariable String releaseId,
                                                    @RequestBody RollbackRequest request) {
        return ResponseEntity.ok(releaseService.triggerRollback(releaseId, request.getReason()));
    }
    
    @PostMapping("/{releaseId}/rollback/execute")
    public ResponseEntity<Release> executeRollback(@PathVariable String releaseId) {
        return ResponseEntity.ok(releaseService.executeRollback(releaseId));
    }
    
    @PostMapping("/{releaseId}/fail")
    public ResponseEntity<Release> failRelease(@PathVariable String releaseId,
                                                @RequestBody RollbackRequest request) {
        return ResponseEntity.ok(releaseService.failRelease(releaseId, request.getReason()));
    }
    
    @GetMapping("/{releaseId}/logs")
    public ResponseEntity<List<OperationLog>> getLogs(@PathVariable String releaseId) {
        return ResponseEntity.ok(logService.getLogsForRelease(releaseId));
    }
    
    @GetMapping("/{releaseId}/logs/failed")
    public ResponseEntity<List<OperationLog>> getFailedLogs(@PathVariable String releaseId) {
        return ResponseEntity.ok(replayService.getFailedOperations(releaseId));
    }
    
    @PostMapping("/{releaseId}/replay/{logId}")
    public ResponseEntity<Release> replayOperation(@PathVariable String releaseId,
                                                    @PathVariable Long logId,
                                                    @RequestParam(required = false, defaultValue = "api") String operator) {
        return ResponseEntity.ok(replayService.replayOperation(releaseId, logId, operator));
    }
    
    @PostMapping("/{releaseId}/replay/all")
    public ResponseEntity<List<Release>> replayAllOperations(@PathVariable String releaseId,
                                                             @RequestParam(required = false, defaultValue = "api") String operator) {
        return ResponseEntity.ok(replayService.replayAllFailedOperations(releaseId, operator));
    }
    
    @PostMapping("/{releaseId}/recover")
    public ResponseEntity<Release> forceRecovery(@PathVariable String releaseId,
                                                  @RequestParam(required = false, defaultValue = "api") String operator) {
        return ResponseEntity.ok(recoveryService.forceRecovery(releaseId, operator));
    }
    
    @GetMapping("/{releaseId}/report")
    public ResponseEntity<String> getReleaseReport(@PathVariable String releaseId) {
        String report = reportService.generateReleaseReport(releaseId);
        return ResponseEntity.ok()
                .header("Content-Type", "text/markdown; charset=utf-8")
                .body(report);
    }
    
    @GetMapping("/report")
    public ResponseEntity<String> getSystemReport(
            @RequestParam(required = false) LocalDateTime startTime,
            @RequestParam(required = false) LocalDateTime endTime) {
        if (startTime == null) {
            startTime = LocalDateTime.now().minusDays(7);
        }
        if (endTime == null) {
            endTime = LocalDateTime.now();
        }
        String report = reportService.generateSystemReport(startTime, endTime);
        return ResponseEntity.ok()
                .header("Content-Type", "text/markdown; charset=utf-8")
                .body(report);
    }
}
