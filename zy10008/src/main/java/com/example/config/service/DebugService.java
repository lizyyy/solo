package com.example.config.service;

import com.example.config.domain.ClientPushStatus;
import com.example.config.domain.ConfigEventLog;
import com.example.config.domain.ConfigRelease;
import com.example.config.util.CollectionUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class DebugService {

    private final EventLogService eventLogService;
    private final ConfigService configService;
    private final PushService pushService;
    private final WebSocketService webSocketService;

    public Map<String, Object> replayEvent(String traceId) {
        List<ConfigEventLog> events = eventLogService.getEventsByTraceId(traceId);
        if (events.isEmpty()) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("traceId", traceId);
            result.put("found", false);
            result.put("message", "未找到相关事件");
            return result;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("traceId", traceId);
        result.put("eventCount", events.size());
        result.put("startTime", events.get(0).getCreatedAt());
        result.put("endTime", events.get(events.size() - 1).getCreatedAt());

        List<Map<String, Object>> eventDetails = new ArrayList<>();
        for (ConfigEventLog event : events) {
            Map<String, Object> detail = new LinkedHashMap<>();
            detail.put("eventId", event.getEventId());
            detail.put("timestamp", event.getCreatedAt());
            detail.put("eventType", event.getEventType());
            detail.put("level", event.getLevel());
            detail.put("entityId", event.getEntityId());
            detail.put("message", event.getMessage());
            detail.put("details", event.getDetails());
            if (event.getStackTrace() != null) {
                detail.put("stackTrace", event.getStackTrace().substring(0, Math.min(2000, event.getStackTrace().length())));
            }
            eventDetails.add(detail);
        }
        result.put("events", eventDetails);

        Optional<ConfigRelease> release = findReleaseFromEvents(events);
        release.ifPresent(r -> {
            Map<String, Object> releaseInfo = new LinkedHashMap<>();
            releaseInfo.put("releaseId", r.getReleaseId());
            releaseInfo.put("namespace", r.getNamespace());
            releaseInfo.put("configKey", r.getConfigKey());
            releaseInfo.put("status", r.getStatus());
            releaseInfo.put("fromVersion", r.getFromVersion());
            releaseInfo.put("toVersion", r.getToVersion());
            result.put("release", releaseInfo);

            List<ClientPushStatus> pushStatuses = pushService.getPushStatusesByRelease(r.getReleaseId());
            List<Map<String, Object>> pushDetails = new ArrayList<>();
            for (ClientPushStatus status : pushStatuses) {
                Map<String, Object> pd = new LinkedHashMap<>();
                pd.put("instanceId", status.getInstanceId());
                pd.put("status", status.getStatus());
                pd.put("retryCount", status.getRetryCount());
                pd.put("lastError", status.getLastError());
                pd.put("succeededAt", status.getSucceededAt());
                pushDetails.add(pd);
            }
            result.put("pushStatuses", pushDetails);
        });

        return result;
    }

    public Map<String, Object> getReleaseTimeline(String releaseId) {
        Optional<ConfigRelease> releaseOpt = configService.getRelease(releaseId);
        if (!releaseOpt.isPresent()) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("releaseId", releaseId);
            result.put("found", false);
            return result;
        }

        ConfigRelease release = releaseOpt.get();
        List<ConfigEventLog> events = eventLogService.getEventsByEntityId(releaseId);
        List<ClientPushStatus> pushStatuses = pushService.getPushStatusesByRelease(releaseId);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("releaseId", releaseId);
        result.put("namespace", release.getNamespace());
        result.put("configKey", release.getConfigKey());
        result.put("status", release.getStatus());
        result.put("createdAt", release.getCreatedAt());
        result.put("completedAt", release.getCompletedAt());

        Map<String, Long> pushSummary = new HashMap<>();
        for (ClientPushStatus status : pushStatuses) {
            String key = status.getStatus().name();
            pushSummary.merge(key, 1L, Long::sum);
        }
        result.put("pushSummary", pushSummary);
        result.put("totalClients", pushStatuses.size());

        List<Map<String, Object>> timeline = new ArrayList<>();

        Map<String, Object> createEvent = new LinkedHashMap<>();
        createEvent.put("time", release.getCreatedAt());
        createEvent.put("type", "RELEASE_CREATED");
        createEvent.put("message", "发布创建: " + release.getNamespace() + "/" + release.getConfigKey());
        timeline.add(createEvent);

        for (ConfigEventLog event : events) {
            Map<String, Object> eventMap = new LinkedHashMap<>();
            eventMap.put("time", event.getCreatedAt());
            eventMap.put("type", event.getEventType().name());
            eventMap.put("level", event.getLevel().name());
            eventMap.put("message", event.getMessage());
            timeline.add(eventMap);
        }

        timeline.sort(Comparator.comparing(m -> (LocalDateTime) m.get("time")));
        result.put("timeline", timeline);

        List<Map<String, Object>> failedPushes = new ArrayList<>();
        for (ClientPushStatus status : pushStatuses) {
            if (status.getStatus() == ClientPushStatus.PushStatus.FAILED) {
                Map<String, Object> failed = new LinkedHashMap<>();
                failed.put("instanceId", status.getInstanceId());
                failed.put("retryCount", status.getRetryCount());
                failed.put("lastError", status.getLastError());
                failed.put("updatedAt", status.getUpdatedAt());

                boolean isConnected = webSocketService.isClientConnected(status.getInstanceId());
                failed.put("currentStatus", isConnected ? "ONLINE" : "OFFLINE");

                failedPushes.add(failed);
            }
        }
        result.put("failedPushes", failedPushes);

        return result;
    }

    public Map<String, Object> getRecentErrors(int minutes) {
        List<ConfigEventLog> errors = eventLogService.getRecentErrors(minutes);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timeWindowMinutes", minutes);
        result.put("totalErrors", errors.size());

        Map<String, Long> errorByType = new HashMap<>();
        Map<String, Long> errorByEntity = new HashMap<>();

        for (ConfigEventLog error : errors) {
            errorByType.merge(error.getEventType().name(), 1L, Long::sum);
            if (error.getEntityId() != null) {
                errorByEntity.merge(error.getEntityId(), 1L, Long::sum);
            }
        }

        result.put("errorByType", errorByType);
        result.put("errorByEntity", errorByEntity);

        List<Map<String, Object>> recentErrors = new ArrayList<>();
        int limit = Math.min(50, errors.size());
        for (int i = 0; i < limit; i++) {
            ConfigEventLog error = errors.get(i);
            Map<String, Object> e = new LinkedHashMap<>();
            e.put("eventId", error.getEventId());
            e.put("traceId", error.getTraceId());
            e.put("timestamp", error.getCreatedAt());
            e.put("eventType", error.getEventType());
            e.put("message", error.getMessage());
            e.put("entityId", error.getEntityId());
            recentErrors.add(e);
        }
        result.put("recentErrors", recentErrors);

        return result;
    }

    public String generateMarkdownReport(String releaseId) {
        Map<String, Object> timeline = getReleaseTimeline(releaseId);
        boolean found = (boolean) timeline.getOrDefault("found", true);
        if (!found) {
            return "# 报告错误\n\n未找到发布记录: " + releaseId;
        }

        StringBuilder sb = new StringBuilder();

        sb.append("# 配置发布报告\n\n");
        sb.append("## 基本信息\n\n");
        sb.append("| 项目 | 内容 |\n");
        sb.append("|------|------|\n");
        sb.append("| 发布ID | ").append(timeline.get("releaseId")).append(" |\n");
        sb.append("| 命名空间 | ").append(timeline.get("namespace")).append(" |\n");
        sb.append("| 配置项 | ").append(timeline.get("configKey")).append(" |\n");
        sb.append("| 状态 | ").append(timeline.get("status")).append(" |\n");
        sb.append("| 创建时间 | ").append(timeline.get("createdAt")).append(" |\n");
        sb.append("| 完成时间 | ").append(timeline.getOrDefault("completedAt", "-")).append(" |\n");
        sb.append("\n");

        Map<String, Long> pushSummary = (Map<String, Long>) timeline.get("pushSummary");
        int totalClients = (int) timeline.get("totalClients");

        sb.append("## 推送统计\n\n");
        sb.append("| 状态 | 数量 | 占比 |\n");
        sb.append("|------|------|------|\n");

        for (Map.Entry<String, Long> entry : pushSummary.entrySet()) {
            double pct = totalClients > 0 ? (entry.getValue() * 100.0 / totalClients) : 0;
            sb.append("| ").append(entry.getKey()).append(" | ")
              .append(entry.getValue()).append(" | ")
              .append(String.format("%.1f%%", pct)).append(" |\n");
        }
        sb.append("| **总计** | **").append(totalClients).append("** | **100%** |\n");
        sb.append("\n");

        List<Map<String, Object>> failedPushes = (List<Map<String, Object>>) timeline.get("failedPushes");
        if (!failedPushes.isEmpty()) {
            sb.append("## 失败详情\n\n");
            for (Map<String, Object> failed : failedPushes) {
                sb.append("### ").append(failed.get("instanceId")).append("\n\n");
                sb.append("- 重试次数: ").append(failed.get("retryCount")).append("\n");
                sb.append("- 当前状态: ").append(failed.get("currentStatus")).append("\n");
                sb.append("- 错误信息: ").append(failed.get("lastError")).append("\n");
                sb.append("- 最后更新: ").append(failed.get("updatedAt")).append("\n\n");
            }
        }

        List<Map<String, Object>> timelineList = (List<Map<String, Object>>) timeline.get("timeline");
        sb.append("## 时间线\n\n");
        sb.append("| 时间 | 类型 | 级别 | 消息 |\n");
        sb.append("|------|------|------|------|\n");

        for (Map<String, Object> event : timelineList) {
            sb.append("| ").append(event.get("time")).append(" | ")
              .append(event.get("type")).append(" | ")
              .append(event.getOrDefault("level", "-")).append(" | ")
              .append(event.get("message")).append(" |\n");
        }

        return sb.toString();
    }

    private Optional<ConfigRelease> findReleaseFromEvents(List<ConfigEventLog> events) {
        for (ConfigEventLog event : events) {
            if (event.getEventType() == ConfigEventLog.EventType.CONFIG_PUBLISH &&
                event.getEntityType() != null &&
                event.getEntityType().equals("ConfigRelease")) {
                return configService.getRelease(event.getEntityId());
            }
        }
        return Optional.empty();
    }
}
