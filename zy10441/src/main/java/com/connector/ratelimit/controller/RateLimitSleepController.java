package com.connector.ratelimit.controller;

import com.connector.ratelimit.model.dto.*;
import com.connector.ratelimit.model.entity.*;
import com.connector.ratelimit.model.enums.SleepStatus;
import com.connector.ratelimit.service.RateLimitSleepService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/rate-limit-sleep")
@RequiredArgsConstructor
public class RateLimitSleepController {

    private final RateLimitSleepService rateLimitSleepService;

    @PostMapping("/connectors")
    public ApiResponse<Connector> createConnector(@Valid @RequestBody ConnectorCreateRequest request) {
        Connector connector = rateLimitSleepService.createConnector(request);
        return ApiResponse.success("创建成功", connector);
    }

    @GetMapping("/connectors")
    public ApiResponse<List<Connector>> getConnectors(
            @RequestParam(required = false) SleepStatus status) {
        List<Connector> connectors;
        if (status != null) {
            connectors = rateLimitSleepService.getConnectorsByStatus(status);
        } else {
            connectors = rateLimitSleepService.getAllConnectors();
        }
        return ApiResponse.success(connectors);
    }

    @GetMapping("/connectors/{connectorCode}")
    public ApiResponse<Connector> getConnector(@PathVariable String connectorCode) {
        return rateLimitSleepService.getConnector(connectorCode)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "连接器不存在"));
    }

    @PostMapping("/detect")
    public ApiResponse<Connector> detectRateLimit(@Valid @RequestBody RateLimitDetectRequest request) {
        return rateLimitSleepService.detectRateLimit(request);
    }

    @PostMapping("/connectors/{connectorCode}/advance")
    public ApiResponse<Connector> advanceStatus(@PathVariable String connectorCode) {
        return rateLimitSleepService.advanceStatus(connectorCode);
    }

    @PostMapping("/manual-correction")
    public ApiResponse<Connector> manualCorrection(@Valid @RequestBody ManualCorrectionRequest request) {
        return rateLimitSleepService.manualCorrection(request);
    }

    @GetMapping("/exceptions")
    public ApiResponse<List<ExceptionRecord>> getExceptionRecords(
            @RequestParam(required = false) String connectorCode) {
        List<ExceptionRecord> records = rateLimitSleepService.getExceptionRecords(connectorCode);
        return ApiResponse.success(records);
    }

    @GetMapping("/recovery-events")
    public ApiResponse<List<RecoveryEvent>> getRecoveryEvents(
            @RequestParam String connectorCode) {
        List<RecoveryEvent> events = rateLimitSleepService.getRecoveryEvents(connectorCode);
        return ApiResponse.success(events);
    }

    @GetMapping("/run-summaries")
    public ApiResponse<List<RunSummary>> getRunSummaries(
            @RequestParam(required = false) String connectorCode,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        List<RunSummary> summaries = rateLimitSleepService.getRunSummaries(connectorCode, startDate, endDate);
        return ApiResponse.success(summaries);
    }

    @GetMapping("/run-summaries/export")
    public ResponseEntity<String> exportRunSummaries(
            @RequestParam(required = false) String connectorCode,
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        String csv = rateLimitSleepService.exportRunSummaries(connectorCode, startDate, endDate);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=run-summaries.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .body(csv);
    }

    @GetMapping("/strategies")
    public ApiResponse<List<SleepStrategy>> getSleepStrategies() {
        List<SleepStrategy> strategies = rateLimitSleepService.getSleepStrategies();
        return ApiResponse.success(strategies);
    }

    @PostMapping("/strategies")
    public ApiResponse<SleepStrategy> createSleepStrategy(@RequestBody SleepStrategy strategy) {
        SleepStrategy saved = rateLimitSleepService.createSleepStrategy(strategy);
        return ApiResponse.success("创建成功", saved);
    }

    @GetMapping("/suppliers")
    public ApiResponse<List<SupplierAccount>> getSupplierAccounts() {
        List<SupplierAccount> accounts = rateLimitSleepService.getSupplierAccounts();
        return ApiResponse.success(accounts);
    }

    @PostMapping("/suppliers")
    public ApiResponse<SupplierAccount> createSupplierAccount(@RequestBody SupplierAccount account) {
        SupplierAccount saved = rateLimitSleepService.createSupplierAccount(account);
        return ApiResponse.success("创建成功", saved);
    }
}
