package com.example.config.service;

import com.example.config.domain.ConfigEventLog;
import com.example.config.domain.ConfigEventLog.EventLevel;
import com.example.config.domain.ConfigEventLog.EventType;
import com.example.config.repository.ConfigEventLogRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class EventLogService {

    private final ConfigEventLogRepository eventLogRepository;
    private final ObjectMapper objectMapper;

    @Value("${config.hot-update.event-log.keep-days:30}")
    private int keepDays;

    @Value("${config.hot-update.event-log.enabled:true}")
    private boolean enabled;

    @Value("${app.instance-id:unknown}")
    private String instanceId;

    private static final ThreadLocal<String> TRACE_ID_HOLDER = new ThreadLocal<>();

    public static String getCurrentTraceId() {
        String traceId = TRACE_ID_HOLDER.get();
        if (traceId == null) {
            traceId = UUID.randomUUID().toString().replace("-", "").substring(0, 24);
            TRACE_ID_HOLDER.set(traceId);
        }
        return traceId;
    }

    public static void setCurrentTraceId(String traceId) {
        TRACE_ID_HOLDER.set(traceId);
    }

    public static void clearTraceId() {
        TRACE_ID_HOLDER.remove();
    }

    public void logEvent(EventType eventType, EventLevel level, String message, Map<String, Object> details) {
        logEvent(eventType, level, null, null, message, details, null);
    }

    public void logEvent(EventType eventType, EventLevel level, String entityId, String entityType,
                         String message, Map<String, Object> details, Throwable throwable) {
        if (!enabled) return;

        try {
            String traceId = getCurrentTraceId();
            String eventId = UUID.randomUUID().toString().replace("-", "");

            ConfigEventLog eventLog = ConfigEventLog.builder()
                    .eventId(eventId)
                    .traceId(traceId)
                    .eventType(eventType)
                    .level(level)
                    .entityId(entityId)
                    .entityType(entityType)
                    .message(message)
                    .details(serializeDetails(details))
                    .stackTrace(throwable != null ? getStackTrace(throwable) : null)
                    .instanceId(instanceId)
                    .createdAt(LocalDateTime.now())
                    .build();

            eventLogRepository.save(eventLog);

            if (level == EventLevel.ERROR || level == EventLevel.FATAL) {
                log.error("[{}] [{}] {} - {}", traceId, eventType, message, details, throwable);
            } else if (level == EventLevel.WARN) {
                log.warn("[{}] [{}] {} - {}", traceId, eventType, message, details);
            } else {
                log.info("[{}] [{}] {} - {}", traceId, eventType, message, details);
            }

        } catch (Exception e) {
            log.error("Failed to log event: {}", e.getMessage(), e);
        }
    }

    public void logConfigCreate(String namespace, String key, String operator) {
        logEvent(EventType.CONFIG_CREATE, EventLevel.INFO,
                namespace + ":" + key, "ConfigItem",
                "配置创建: " + namespace + "/" + key,
                Collections.singletonMap("operator", operator), null);
    }

    public void logConfigUpdate(String namespace, String key, Long fromVersion, Long toVersion, String operator) {
        logEvent(EventType.CONFIG_UPDATE, EventLevel.INFO,
                namespace + ":" + key, "ConfigItem",
                "配置更新: " + namespace + "/" + key + " v" + fromVersion + " -> v" + toVersion,
                Map.of("operator", operator, "fromVersion", fromVersion, "toVersion", toVersion), null);
    }

    public void logConfigPublish(String releaseId, String namespace, String key, String operator) {
        logEvent(EventType.CONFIG_PUBLISH, EventLevel.INFO,
                releaseId, "ConfigRelease",
                "配置发布开始: " + namespace + "/" + key,
                Map.of("operator", operator, "namespace", namespace, "key", key), null);
    }

    public void logPushStart(String releaseId, String instanceId) {
        logEvent(EventType.PUSH_START, EventLevel.DEBUG,
                releaseId + ":" + instanceId, "ClientPushStatus",
                "开始推送配置到客户端: " + instanceId,
                Map.of("releaseId", releaseId, "instanceId", instanceId), null);
    }

    public void logPushSuccess(String releaseId, String instanceId, long latencyMs) {
        logEvent(EventType.PUSH_SUCCESS, EventLevel.INFO,
                releaseId + ":" + instanceId, "ClientPushStatus",
                "配置推送成功: " + instanceId + ", 耗时: " + latencyMs + "ms",
                Map.of("releaseId", releaseId, "instanceId", instanceId, "latencyMs", latencyMs), null);
    }

    public void logPushFailed(String releaseId, String instanceId, String reason, Throwable t) {
        logEvent(EventType.PUSH_FAILED, EventLevel.ERROR,
                releaseId + ":" + instanceId, "ClientPushStatus",
                "配置推送失败: " + instanceId + " - " + reason,
                Map.of("releaseId", releaseId, "instanceId", instanceId, "reason", reason), t);
    }

    public void logPushRetry(String releaseId, String instanceId, int retryCount) {
        logEvent(EventType.PUSH_RETRY, EventLevel.WARN,
                releaseId + ":" + instanceId, "ClientPushStatus",
                "配置推送重试: " + instanceId + ", 第" + retryCount + "次重试",
                Map.of("releaseId", releaseId, "instanceId", instanceId, "retryCount", retryCount), null);
    }

    public void logClientConnect(String instanceId, String serviceName) {
        logEvent(EventType.CLIENT_CONNECT, EventLevel.INFO,
                instanceId, "ClientRegistry",
                "客户端连接: " + serviceName + "@" + instanceId,
                Map.of("serviceName", serviceName), null);
    }

    public void logClientDisconnect(String instanceId, String reason) {
        logEvent(EventType.CLIENT_DISCONNECT, EventLevel.INFO,
                instanceId, "ClientRegistry",
                "客户端断开连接: " + instanceId + " - " + reason,
                Map.of("reason", reason), null);
    }

    public void logCacheUpdate(String key, Long version) {
        logEvent(EventType.CACHE_UPDATE, EventLevel.DEBUG,
                key, "Cache",
                "缓存更新: " + key + " v" + version,
                Map.of("key", key, "version", version), null);
    }

    public void logCacheInvalidate(String key) {
        logEvent(EventType.CACHE_INVALIDATE, EventLevel.DEBUG,
                key, "Cache",
                "缓存失效: " + key,
                Map.of("key", key), null);
    }

    public void logRollbackStart(String releaseId, String reason) {
        logEvent(EventType.ROLLBACK_START, EventLevel.WARN,
                releaseId, "ConfigRelease",
                "开始回滚发布: " + releaseId + " - " + reason,
                Map.of("reason", reason), null);
    }

    public void logRollbackComplete(String releaseId) {
        logEvent(EventType.ROLLBACK_COMPLETE, EventLevel.INFO,
                releaseId, "ConfigRelease",
                "回滚完成: " + releaseId,
                Collections.emptyMap(), null);
    }

    public void logSystemError(String message, Throwable t) {
        logEvent(EventType.SYSTEM_ERROR, EventLevel.ERROR,
                null, "System",
                message,
                Collections.emptyMap(), t);
    }

    public List<ConfigEventLog> getEventsByTraceId(String traceId) {
        return eventLogRepository.findByTraceIdOrderByCreatedAtAsc(traceId);
    }

    public List<ConfigEventLog> getEventsByEntityId(String entityId) {
        return eventLogRepository.findByEntityIdOrderByCreatedAtAsc(entityId);
    }

    public List<ConfigEventLog> getEventsByTimeRange(LocalDateTime from, LocalDateTime to) {
        return eventLogRepository.findByTimeRange(from, to);
    }

    public List<ConfigEventLog> getRecentErrors(int minutes) {
        LocalDateTime from = LocalDateTime.now().minusMinutes(minutes);
        return eventLogRepository.findRecentErrors(Arrays.asList(EventLevel.ERROR, EventLevel.FATAL), from);
    }

    private String serializeDetails(Map<String, Object> details) {
        if (details == null || details.isEmpty()) return null;
        try {
            return objectMapper.writeValueAsString(details);
        } catch (JsonProcessingException e) {
            return details.toString();
        }
    }

    private String getStackTrace(Throwable throwable) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        throwable.printStackTrace(pw);
        return sw.toString();
    }

    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanupOldEvents() {
        LocalDateTime threshold = LocalDateTime.now().minusDays(keepDays);
        List<ConfigEventLog> oldEvents = eventLogRepository.findOldEvents(threshold);
        if (!oldEvents.isEmpty()) {
            eventLogRepository.deleteAll(oldEvents);
            log.info("清理了 {} 条历史事件日志", oldEvents.size());
        }
    }
}
