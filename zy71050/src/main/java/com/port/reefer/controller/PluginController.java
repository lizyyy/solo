package com.port.reefer.controller;

import com.port.reefer.dto.*;
import com.port.reefer.entity.AlarmRecord;
import com.port.reefer.entity.AuditLog;
import com.port.reefer.entity.PluginReport;
import com.port.reefer.entity.PowerSocket;
import com.port.reefer.entity.ReeferContainer;
import com.port.reefer.entity.TemperatureSample;
import com.port.reefer.repository.AuditLogRepository;
import com.port.reefer.repository.PowerSocketRepository;
import com.port.reefer.repository.ReeferContainerRepository;
import com.port.reefer.service.*;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/plugin")
public class PluginController {
    private static final Logger log = LoggerFactory.getLogger(PluginController.class);
    
    private final PowerSocketService powerSocketService;
    private final TemperatureService temperatureService;
    private final AlarmService alarmService;
    private final ReportService reportService;
    private final ValidationService validationService;
    private final AuditLogRepository auditLogRepository;
    private final PowerSocketRepository powerSocketRepository;
    private final ReeferContainerRepository reeferContainerRepository;

    public PluginController(PowerSocketService powerSocketService,
                           TemperatureService temperatureService,
                           AlarmService alarmService,
                           ReportService reportService,
                           ValidationService validationService,
                           AuditLogRepository auditLogRepository,
                           PowerSocketRepository powerSocketRepository,
                           ReeferContainerRepository reeferContainerRepository) {
        this.powerSocketService = powerSocketService;
        this.temperatureService = temperatureService;
        this.alarmService = alarmService;
        this.reportService = reportService;
        this.validationService = validationService;
        this.auditLogRepository = auditLogRepository;
        this.powerSocketRepository = powerSocketRepository;
        this.reeferContainerRepository = reeferContainerRepository;
    }

    @GetMapping("/sockets")
    public ApiResponse<List<Map<String, Object>>> listSockets() {
        List<PowerSocket> sockets = powerSocketRepository.findAll();
        return ApiResponse.success(sockets.stream()
                .map(s -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", s.getId());
                    map.put("socketCode", s.getSocketCode());
                    map.put("status", s.getStatus());
                    map.put("location", s.getLocation());
                    return map;
                })
                .collect(Collectors.toList()));
    }

    @GetMapping("/containers")
    public ApiResponse<List<Map<String, Object>>> listContainers() {
        List<ReeferContainer> containers = reeferContainerRepository.findAll();
        return ApiResponse.success(containers.stream()
                .map(c -> {
                    Map<String, Object> map = new HashMap<>();
                    map.put("id", c.getId());
                    map.put("containerNumber", c.getContainerNumber());
                    map.put("targetTemperature", c.getTargetTemperature());
                    map.put("vesselName", c.getVesselName());
                    return map;
                })
                .collect(Collectors.toList()));
    }

    @PostMapping("/plugin")
    public ApiResponse<PluginReport> plugin(@Valid @RequestBody PluginRequest request) {
        return ApiResponse.success(powerSocketService.plugin(request));
    }

    @PostMapping("/unplug")
    public ApiResponse<PluginReport> unplug(@Valid @RequestBody UnplugRequest request) {
        return ApiResponse.success(powerSocketService.unplug(request));
    }

    @PostMapping("/temperature")
    public ApiResponse<TemperatureSample> recordTemperature(@Valid @RequestBody TemperatureSampleRequest request) {
        return ApiResponse.success(temperatureService.addSample(request));
    }

    @GetMapping("/alarm/pending")
    public ApiResponse<List<AlarmRecord>> getPendingAlarms() {
        return ApiResponse.success(alarmService.getPendingAlarms());
    }

    @PostMapping("/alarm/acknowledge")
    public ApiResponse<AlarmRecord> acknowledgeAlarm(@Valid @RequestBody AlarmHandleRequest request) {
        return ApiResponse.success(alarmService.acknowledge(request));
    }

    @PostMapping("/alarm/resolve")
    public ApiResponse<AlarmRecord> resolveAlarm(@Valid @RequestBody AlarmHandleRequest request) {
        return ApiResponse.success(alarmService.resolve(request));
    }

    @PostMapping("/alarm/false")
    public ApiResponse<AlarmRecord> markFalseAlarm(@Valid @RequestBody AlarmHandleRequest request) {
        return ApiResponse.success(alarmService.markFalseAlarm(request));
    }

    @GetMapping("/validate/socket/{socketCode}")
    public ApiResponse<Map<String, Object>> validateSocket(@PathVariable String socketCode) {
        return ApiResponse.success(validationService.validateSocket(socketCode));
    }

    @GetMapping("/validate/container/{containerNumber}")
    public ApiResponse<Map<String, Object>> validateContainer(@PathVariable String containerNumber) {
        return ApiResponse.success(validationService.validateContainer(containerNumber));
    }

    @GetMapping("/validate/plugin")
    public ApiResponse<Map<String, Object>> validatePlugin(
            @RequestParam String containerNumber,
            @RequestParam String socketCode) {
        return ApiResponse.success(validationService.validatePlugin(containerNumber, socketCode));
    }

    @PostMapping("/supplement")
    public ApiResponse<Map<String, Object>> supplementProof(
            @RequestParam Long reportId,
            @RequestParam String inspectorBadge,
            @RequestParam String remarks) {
        return ApiResponse.success(validationService.supplementProof(reportId, inspectorBadge, remarks));
    }

    @GetMapping("/report/{reportNumber}")
    public ApiResponse<Map<String, Object>> getReport(@PathVariable String reportNumber) {
        return ApiResponse.success(reportService.getReportDetail(reportNumber));
    }

    @GetMapping("/reports")
    public ApiResponse<List<Map<String, Object>>> getReports(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ApiResponse.success(reportService.getReportsByTime(start, end));
    }

    @GetMapping("/container/{containerNumber}/reports")
    public ApiResponse<List<Map<String, Object>>> getContainerReports(@PathVariable String containerNumber) {
        return ApiResponse.success(reportService.getContainerReports(containerNumber));
    }

    @GetMapping("/review")
    public ApiResponse<Map<String, Object>> getReviewData(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime start,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime end) {
        return ApiResponse.success(reportService.getReviewData(start, end));
    }

    @GetMapping(value = "/export/{reportNumber}", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> exportReport(@PathVariable String reportNumber) {
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"" + reportNumber + ".txt\"")
                .body(reportService.exportReport(reportNumber));
    }

    @GetMapping("/audit/{entityType}/{entityId}")
    public ApiResponse<List<AuditLog>> getAuditLogs(
            @PathVariable String entityType,
            @PathVariable Long entityId) {
        return ApiResponse.success(auditLogRepository.findByEntityTypeAndEntityIdOrderByCreatedAtDesc(entityType, entityId));
    }

    @GetMapping("/health")
    public ApiResponse<Map<String, Object>> healthCheck() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", LocalDateTime.now());
        health.put("socketCount", powerSocketRepository.count());
        health.put("containerCount", reeferContainerRepository.count());
        return ApiResponse.success(health);
    }
}
