package com.tokenexchange.controller;

import com.tokenexchange.dto.*;
import com.tokenexchange.entity.*;
import com.tokenexchange.service.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api/token")
@RequiredArgsConstructor
public class TokenExchangeController {
    private final TokenExchangeService tokenExchangeService;
    private final TimelineService timelineService;
    private final UsageRecordService usageRecordService;
    private final DiagnosticService diagnosticService;

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isBlank() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }

    private String getUserAgent(HttpServletRequest request) {
        return request.getHeader("User-Agent");
    }

    @PostMapping("/exchange")
    public ResponseEntity<ApiResponse<TokenExchangeResponse>> exchangeToken(
            @Valid @RequestBody TokenExchangeRequest request,
            HttpServletRequest httpRequest) {
        log.info("Token exchange request from user: {}", request.getSourceServiceId());
        TokenExchangeResponse response = tokenExchangeService.exchangeToken(
                request, getClientIp(httpRequest), getUserAgent(httpRequest));
        return ResponseEntity.ok(ApiResponse.success("令牌交换成功", response));
    }

    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<TokenValidationResponse>> validateToken(
            @Valid @RequestBody TokenValidationRequest request,
            HttpServletRequest httpRequest) {
        TokenValidationResponse response = tokenExchangeService.validateToken(
                request, getClientIp(httpRequest), getUserAgent(httpRequest));
        return ResponseEntity.ok(ApiResponse.success("令牌验证成功", response));
    }

    @PostMapping("/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeToken(
            @Valid @RequestBody TokenRevokeRequest request,
            HttpServletRequest httpRequest) {
        ApiResponse<Void> response = tokenExchangeService.revokeToken(
                request, getClientIp(httpRequest), getUserAgent(httpRequest));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/timeline/{entityId}")
    public ResponseEntity<ApiResponse<List<TimelineEvent>>> getTimeline(
            @PathVariable String entityId,
            @RequestParam(required = false) String entityType) {
        List<TimelineEvent> events;
        if (entityType != null && !entityType.isBlank()) {
            events = timelineService.getEntityTimeline(entityId, entityType);
        } else {
            events = timelineService.getEntityTimeline(entityId);
        }
        return ResponseEntity.ok(ApiResponse.success("时间线查询成功", events));
    }

    @GetMapping("/timeline")
    public ResponseEntity<ApiResponse<List<TimelineEvent>>> getTimelineByTimeRange(
            @RequestParam LocalDateTime start,
            @RequestParam LocalDateTime end) {
        List<TimelineEvent> events = timelineService.getTimeRangeTimeline(start, end);
        return ResponseEntity.ok(ApiResponse.success("时间线查询成功", events));
    }

    @GetMapping("/usage/token/{tokenValue}")
    public ResponseEntity<ApiResponse<List<UsageRecord>>> getTokenUsageHistory(
            @PathVariable String tokenValue) {
        List<UsageRecord> records = usageRecordService.getTokenUsageHistory(tokenValue);
        return ResponseEntity.ok(ApiResponse.success("使用记录查询成功", records));
    }

    @GetMapping("/usage/user/{userId}")
    public ResponseEntity<ApiResponse<List<UsageRecord>>> getUserUsageHistory(
            @PathVariable String userId,
            @RequestParam(required = false) LocalDateTime start,
            @RequestParam(required = false) LocalDateTime end) {
        List<UsageRecord> records;
        if (start != null && end != null) {
            records = usageRecordService.getUserUsageHistory(userId, start, end);
        } else {
            records = usageRecordService.getUserUsageHistory(userId);
        }
        return ResponseEntity.ok(ApiResponse.success("使用记录查询成功", records));
    }

    @GetMapping("/usage/service/{serviceId}")
    public ResponseEntity<ApiResponse<List<UsageRecord>>> getServiceUsageHistory(
            @PathVariable String serviceId) {
        List<UsageRecord> records = usageRecordService.getServiceUsageHistory(serviceId);
        return ResponseEntity.ok(ApiResponse.success("使用记录查询成功", records));
    }

    @GetMapping("/diagnostic/token/{tokenValue}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTokenDiagnosticReport(
            @PathVariable String tokenValue) {
        Map<String, Object> report = diagnosticService.generateTokenDiagnosticReport(tokenValue);
        return ResponseEntity.ok(ApiResponse.success("诊断报告生成成功", report));
    }

    @GetMapping("/diagnostic/user/{userId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUserDiagnosticReport(
            @PathVariable String userId,
            @RequestParam(defaultValue = "24") int hours) {
        Map<String, Object> report = diagnosticService.generateUserDiagnosticReport(userId, hours);
        return ResponseEntity.ok(ApiResponse.success("用户诊断报告生成成功", report));
    }

    @GetMapping("/diagnostic/summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getSystemDiagnosticSummary() {
        Map<String, Object> summary = diagnosticService.generateSystemDiagnosticSummary();
        return ResponseEntity.ok(ApiResponse.success("系统诊断汇总生成成功", summary));
    }
}
