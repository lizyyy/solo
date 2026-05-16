package com.statuspage.controller;

import com.statuspage.dto.*;
import com.statuspage.model.*;
import com.statuspage.service.ExportService;
import com.statuspage.service.IncidentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1/incidents")
@RequiredArgsConstructor
public class IncidentController {
    private final IncidentService incidentService;
    private final ExportService exportService;

    @PostMapping
    public ResponseEntity<ApiResponse<Incident>> createIncident(@Valid @RequestBody CreateIncidentRequest request) {
        Incident incident = incidentService.createIncident(request);
        return ResponseEntity.ok(ApiResponse.success("事故创建成功", incident));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Incident>>> getAllIncidents() {
        List<Incident> incidents = incidentService.getAllIncidents();
        return ResponseEntity.ok(ApiResponse.success(incidents));
    }

    @GetMapping("/active")
    public ResponseEntity<ApiResponse<List<Incident>>> getActiveIncidents() {
        List<Incident> incidents = incidentService.getActiveIncidents();
        return ResponseEntity.ok(ApiResponse.success(incidents));
    }

    @GetMapping("/{incidentNumber}")
    public ResponseEntity<ApiResponse<Incident>> getIncident(@PathVariable String incidentNumber) {
        Incident incident = incidentService.getIncident(incidentNumber);
        return ResponseEntity.ok(ApiResponse.success(incident));
    }

    @PostMapping("/{incidentNumber}/announcements")
    public ResponseEntity<ApiResponse<Announcement>> createAnnouncement(
            @PathVariable String incidentNumber,
            @Valid @RequestBody CreateAnnouncementRequest request) {
        Announcement announcement = incidentService.createAnnouncement(incidentNumber, request);
        return ResponseEntity.ok(ApiResponse.success("公告创建成功", announcement));
    }

    @GetMapping("/{incidentNumber}/announcements")
    public ResponseEntity<ApiResponse<List<Announcement>>> getAnnouncements(@PathVariable String incidentNumber) {
        List<Announcement> announcements = incidentService.getAnnouncements(incidentNumber);
        return ResponseEntity.ok(ApiResponse.success(announcements));
    }

    @PostMapping("/{incidentNumber}/confirmations")
    public ResponseEntity<ApiResponse<Confirmation>> confirmAnnouncement(
            @PathVariable String incidentNumber,
            @Valid @RequestBody ConfirmationRequest request) {
        Confirmation confirmation = incidentService.confirmAnnouncement(incidentNumber, request);
        return ResponseEntity.ok(ApiResponse.success("确认成功", confirmation));
    }

    @GetMapping("/{incidentNumber}/confirmations")
    public ResponseEntity<ApiResponse<List<Confirmation>>> getConfirmations(@PathVariable String incidentNumber) {
        List<Confirmation> confirmations = incidentService.getConfirmations(incidentNumber);
        return ResponseEntity.ok(ApiResponse.success(confirmations));
    }

    @GetMapping("/announcements/{announcementId}/confirmations")
    public ResponseEntity<ApiResponse<List<Confirmation>>> getAnnouncementConfirmations(@PathVariable Long announcementId) {
        List<Confirmation> confirmations = incidentService.getAnnouncementConfirmations(announcementId);
        return ResponseEntity.ok(ApiResponse.success(confirmations));
    }

    @PostMapping("/{incidentNumber}/status")
    public ResponseEntity<ApiResponse<Incident>> transitionStatus(
            @PathVariable String incidentNumber,
            @Valid @RequestBody StatusTransitionRequest request) {
        Incident incident = incidentService.transitionStatus(incidentNumber, request);
        return ResponseEntity.ok(ApiResponse.success("状态更新成功", incident));
    }

    @PostMapping("/{incidentNumber}/correct")
    public ResponseEntity<ApiResponse<Incident>> manualCorrect(
            @PathVariable String incidentNumber,
            @RequestBody ManualCorrectionRequest request) {
        Incident incident = incidentService.manualCorrect(incidentNumber, request);
        return ResponseEntity.ok(ApiResponse.success("人工修正成功", incident));
    }

    @GetMapping("/{incidentNumber}/exception-logs")
    public ResponseEntity<ApiResponse<List<ExceptionLog>>> getExceptionLogs(@PathVariable String incidentNumber) {
        List<ExceptionLog> logs = incidentService.getExceptionLogs(incidentNumber);
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @GetMapping("/exception-logs")
    public ResponseEntity<ApiResponse<List<ExceptionLog>>> getAllExceptionLogs() {
        List<ExceptionLog> logs = incidentService.getAllExceptionLogs();
        return ResponseEntity.ok(ApiResponse.success(logs));
    }

    @PostMapping("/exception-logs/{exceptionLogId}/resolve")
    public ResponseEntity<ApiResponse<ExceptionLog>> resolveExceptionLog(
            @PathVariable Long exceptionLogId,
            @RequestParam(required = false) String conclusion,
            @RequestParam String resolvedBy) {
        ExceptionLog log = incidentService.resolveExceptionLog(exceptionLogId, conclusion, resolvedBy);
        return ResponseEntity.ok(ApiResponse.success("异常日志已处理", log));
    }

    @GetMapping("/{incidentNumber}/export")
    public ResponseEntity<ApiResponse<ExportResult>> exportSummary(@PathVariable String incidentNumber) {
        ExportResult result = exportService.exportIncidentSummary(incidentNumber);
        return ResponseEntity.ok(ApiResponse.success("导出成功", result));
    }

    @GetMapping("/{incidentNumber}/download")
    public ResponseEntity<byte[]> downloadSummary(@PathVariable String incidentNumber) {
        ExportResult result = exportService.exportIncidentSummary(incidentNumber);
        byte[] content = result.getContent().getBytes(StandardCharsets.UTF_8);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + result.getFileName() + "\"")
                .contentType(MediaType.TEXT_MARKDOWN)
                .body(content);
    }
}