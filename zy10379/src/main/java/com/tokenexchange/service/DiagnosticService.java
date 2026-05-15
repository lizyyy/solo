package com.tokenexchange.service;

import com.tokenexchange.entity.*;
import com.tokenexchange.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DiagnosticService {
    private final UserTokenRepository userTokenRepository;
    private final ShortTokenRepository shortTokenRepository;
    private final ServiceIdentityRepository serviceIdentityRepository;
    private final ExchangeScenarioRepository exchangeScenarioRepository;
    private final TimelineEventRepository timelineEventRepository;
    private final UsageRecordRepository usageRecordRepository;

    public Map<String, Object> generateTokenDiagnosticReport(String tokenValue) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("tokenValue", maskToken(tokenValue));
        report.put("generatedAt", LocalDateTime.now());

        Optional<ShortToken> shortTokenOpt = shortTokenRepository.findByTokenValue(tokenValue);
        if (shortTokenOpt.isPresent()) {
            ShortToken token = shortTokenOpt.get();
            report.put("tokenType", "SHORT_TOKEN");
            report.put("userId", token.getUserId());
            report.put("sourceServiceId", token.getSourceServiceId());
            report.put("targetServiceId", token.getTargetServiceId());
            report.put("scenarioCode", token.getScenarioCode());
            report.put("scopes", token.getScopes());
            report.put("issuedAt", token.getIssuedAt());
            report.put("expiresAt", token.getExpiresAt());
            report.put("isExpired", token.isExpired());
            report.put("isRevoked", token.getRevoked());
            report.put("revokedAt", token.getRevokedAt());
            report.put("revokeReason", token.getRevokeReason());
            report.put("useCount", token.getUseCount());
            report.put("maxUseCount", token.getMaxUseCount());
            report.put("isExhausted", token.isExhausted());
            report.put("isValid", token.isValid());
            report.put("createdAt", token.getCreatedAt());
            report.put("updatedAt", token.getUpdatedAt());

            List<TimelineEvent> timelineEvents = timelineEventRepository
                    .findByEntityIdOrderByTimestampDesc(tokenValue);
            report.put("timelineEventCount", timelineEvents.size());
            report.put("timelineEvents", summarizeTimelineEvents(timelineEvents));

            List<UsageRecord> usageRecords = usageRecordRepository
                    .findByTokenValueOrderByTimestampDesc(tokenValue);
            report.put("usageRecordCount", usageRecords.size());
            report.put("usageRecords", summarizeUsageRecords(usageRecords));

            long successCount = usageRecords.stream().filter(UsageRecord::getSuccess).count();
            long failureCount = usageRecords.size() - successCount;
            report.put("successUsageCount", successCount);
            report.put("failureUsageCount", failureCount);
            report.put("successRate", usageRecords.isEmpty() ? 0.0 : 
                    (double) successCount / usageRecords.size() * 100);
        } else {
            Optional<UserToken> userTokenOpt = userTokenRepository.findByTokenValue(tokenValue);
            if (userTokenOpt.isPresent()) {
                UserToken token = userTokenOpt.get();
                report.put("tokenType", "USER_TOKEN");
                report.put("userId", token.getUserId());
                report.put("scopes", token.getScopes());
                report.put("issuedAt", token.getIssuedAt());
                report.put("expiresAt", token.getExpiresAt());
                report.put("isExpired", token.isExpired());
                report.put("isRevoked", token.getRevoked());
                report.put("revokedAt", token.getRevokedAt());
                report.put("revokeReason", token.getRevokeReason());
                report.put("isValid", token.isValid());
                report.put("createdAt", token.getCreatedAt());
                report.put("updatedAt", token.getUpdatedAt());

                List<TimelineEvent> timelineEvents = timelineEventRepository
                        .findByEntityIdOrderByTimestampDesc(tokenValue);
                report.put("timelineEventCount", timelineEvents.size());
                report.put("timelineEvents", summarizeTimelineEvents(timelineEvents));

                List<UsageRecord> usageRecords = usageRecordRepository
                        .findByTokenValueOrderByTimestampDesc(tokenValue);
                report.put("usageRecordCount", usageRecords.size());
                report.put("usageRecords", summarizeUsageRecords(usageRecords));

                long successCount = usageRecords.stream().filter(UsageRecord::getSuccess).count();
                long failureCount = usageRecords.size() - successCount;
                report.put("successUsageCount", successCount);
                report.put("failureUsageCount", failureCount);
                report.put("successRate", usageRecords.isEmpty() ? 0.0 : 
                        (double) successCount / usageRecords.size() * 100);
            } else {
                report.put("tokenType", "UNKNOWN");
                report.put("found", false);
                report.put("message", "令牌不存在或已被删除");
            }
        }

        return report;
    }

    public Map<String, Object> generateUserDiagnosticReport(String userId, int hours) {
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("userId", userId);
        report.put("generatedAt", LocalDateTime.now());
        report.put("reportTimeRangeHours", hours);

        LocalDateTime startTime = LocalDateTime.now().minusHours(hours);
        LocalDateTime endTime = LocalDateTime.now();

        List<UserToken> userTokens = userTokenRepository.findByUserId(userId);
        report.put("totalUserTokens", userTokens.size());
        report.put("activeUserTokens", userTokens.stream().filter(UserToken::isValid).count());
        report.put("revokedUserTokens", userTokens.stream().filter(t -> t.getRevoked()).count());
        report.put("expiredUserTokens", userTokens.stream().filter(UserToken::isExpired).count());

        List<ShortToken> shortTokens = shortTokenRepository.findByUserId(userId);
        report.put("totalShortTokens", shortTokens.size());
        report.put("activeShortTokens", shortTokens.stream().filter(ShortToken::isValid).count());
        report.put("revokedShortTokens", shortTokens.stream().filter(t -> t.getRevoked()).count());
        report.put("expiredShortTokens", shortTokens.stream().filter(ShortToken::isExpired).count());
        report.put("exhaustedShortTokens", shortTokens.stream().filter(ShortToken::isExhausted).count());

        Map<String, Long> serviceExchangeCounts = shortTokens.stream()
                .collect(Collectors.groupingBy(ShortToken::getTargetServiceId, Collectors.counting()));
        report.put("exchangeByService", serviceExchangeCounts);

        List<UsageRecord> usageRecords = usageRecordRepository
                .findByUserIdAndTimeRange(userId, startTime, endTime);
        report.put("totalUsageRecordsInPeriod", usageRecords.size());

        long successCount = usageRecords.stream().filter(UsageRecord::getSuccess).count();
        long failureCount = usageRecords.size() - successCount;
        report.put("successUsageCount", successCount);
        report.put("failureUsageCount", failureCount);
        report.put("successRate", usageRecords.isEmpty() ? 0.0 : 
                (double) successCount / usageRecords.size() * 100);

        Map<String, Long> operationCounts = usageRecords.stream()
                .collect(Collectors.groupingBy(UsageRecord::getOperation, Collectors.counting()));
        report.put("usageByOperation", operationCounts);

        Map<String, Long> serviceUsageCounts = usageRecords.stream()
                .filter(r -> r.getServiceId() != null)
                .collect(Collectors.groupingBy(UsageRecord::getServiceId, Collectors.counting()));
        report.put("usageByService", serviceUsageCounts);

        List<UsageRecord> failures = usageRecords.stream()
                .filter(r -> !r.getSuccess())
                .limit(10)
                .collect(Collectors.toList());
        report.put("recentFailures", summarizeUsageRecords(failures));

        List<TimelineEvent> allEvents = new ArrayList<>();
        for (UserToken token : userTokens) {
            allEvents.addAll(timelineEventRepository.findByEntityIdOrderByTimestampDesc(token.getTokenValue()));
        }
        for (ShortToken token : shortTokens) {
            allEvents.addAll(timelineEventRepository.findByEntityIdOrderByTimestampDesc(token.getTokenValue()));
        }
        
        allEvents.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        report.put("totalTimelineEvents", allEvents.size());
        report.put("recentEvents", summarizeTimelineEvents(allEvents.stream().limit(20).collect(Collectors.toList())));

        Map<String, Long> eventTypeCounts = allEvents.stream()
                .collect(Collectors.groupingBy(TimelineEvent::getEventType, Collectors.counting()));
        report.put("eventByType", eventTypeCounts);

        return report;
    }

    public Map<String, Object> generateSystemDiagnosticSummary() {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("generatedAt", LocalDateTime.now());

        List<ServiceIdentity> services = serviceIdentityRepository.findAll();
        summary.put("totalServices", services.size());
        summary.put("activeServices", services.stream().filter(ServiceIdentity::getEnabled).count());
        summary.put("services", summarizeServices(services));

        List<ExchangeScenario> scenarios = exchangeScenarioRepository.findAll();
        summary.put("totalScenarios", scenarios.size());
        summary.put("activeScenarios", scenarios.stream().filter(ExchangeScenario::getEnabled).count());

        List<UserToken> userTokens = userTokenRepository.findAll();
        summary.put("totalUserTokens", userTokens.size());
        summary.put("activeUserTokens", userTokens.stream().filter(UserToken::isValid).count());
        summary.put("revokedUserTokens", userTokens.stream().filter(t -> t.getRevoked()).count());
        summary.put("expiredUserTokens", userTokens.stream().filter(UserToken::isExpired).count());

        List<ShortToken> shortTokens = shortTokenRepository.findAll();
        summary.put("totalShortTokens", shortTokens.size());
        summary.put("activeShortTokens", shortTokens.stream().filter(ShortToken::isValid).count());
        summary.put("revokedShortTokens", shortTokens.stream().filter(t -> t.getRevoked()).count());
        summary.put("expiredShortTokens", shortTokens.stream().filter(ShortToken::isExpired).count());
        summary.put("exhaustedShortTokens", shortTokens.stream().filter(ShortToken::isExhausted).count());

        LocalDateTime last24Hours = LocalDateTime.now().minusHours(24);
        List<UsageRecord> usage24h = usageRecordRepository.findByTimestampBetweenOrderByTimestampDesc(
                last24Hours, LocalDateTime.now());
        summary.put("usageRecordsLast24h", usage24h.size());
        
        long success24h = usage24h.stream().filter(UsageRecord::getSuccess).count();
        summary.put("successUsageLast24h", success24h);
        summary.put("failureUsageLast24h", usage24h.size() - success24h);
        summary.put("successRateLast24h", usage24h.isEmpty() ? 0.0 : 
                (double) success24h / usage24h.size() * 100);

        Map<String, Long> operationCounts24h = usage24h.stream()
                .collect(Collectors.groupingBy(UsageRecord::getOperation, Collectors.counting()));
        summary.put("usageByOperationLast24h", operationCounts24h);

        Map<String, Long> userExchangeCounts = shortTokens.stream()
                .collect(Collectors.groupingBy(ShortToken::getUserId, Collectors.counting()));
        List<Map.Entry<String, Long>> topUsers = userExchangeCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .collect(Collectors.toList());
        summary.put("topUsersByExchangeCount", topUsers);

        Map<String, Long> serviceExchangeCounts = shortTokens.stream()
                .collect(Collectors.groupingBy(ShortToken::getTargetServiceId, Collectors.counting()));
        List<Map.Entry<String, Long>> topServices = serviceExchangeCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .collect(Collectors.toList());
        summary.put("topServicesByExchangeCount", topServices);

        return summary;
    }

    private List<Map<String, Object>> summarizeTimelineEvents(List<TimelineEvent> events) {
        return events.stream().map(event -> {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("timestamp", event.getTimestamp());
            summary.put("eventType", event.getEventType());
            summary.put("description", event.getDescription());
            summary.put("operatorId", event.getOperatorId());
            summary.put("requestId", event.getRequestId());
            return summary;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> summarizeUsageRecords(List<UsageRecord> records) {
        return records.stream().map(record -> {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("timestamp", record.getTimestamp());
            summary.put("operation", record.getOperation());
            summary.put("serviceId", record.getServiceId());
            summary.put("success", record.getSuccess());
            summary.put("errorMessage", record.getErrorMessage());
            summary.put("clientIp", maskIp(record.getClientIp()));
            summary.put("requestId", record.getRequestId());
            return summary;
        }).collect(Collectors.toList());
    }

    private List<Map<String, Object>> summarizeServices(List<ServiceIdentity> services) {
        return services.stream().map(service -> {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("serviceId", service.getServiceId());
            summary.put("serviceName", service.getServiceName());
            summary.put("enabled", service.getEnabled());
            summary.put("allowedScopes", service.getAllowedScopes());
            summary.put("createdAt", service.getCreatedAt());
            return summary;
        }).collect(Collectors.toList());
    }

    private String maskToken(String token) {
        if (token == null || token.length() < 16) {
            return "***";
        }
        return token.substring(0, 8) + "..." + token.substring(token.length() - 8);
    }

    private String maskIp(String ip) {
        if (ip == null || !ip.contains(".")) {
            return ip;
        }
        String[] parts = ip.split("\\.");
        if (parts.length == 4) {
            return parts[0] + "." + parts[1] + ".***.***";
        }
        return ip;
    }
}
