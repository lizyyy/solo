package com.example.config.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "config_event_log", indexes = {
        @Index(name = "idx_event_id", columnList = "eventId", unique = true),
        @Index(name = "idx_event_type", columnList = "eventType"),
        @Index(name = "idx_entity_id", columnList = "entityId"),
        @Index(name = "idx_created_at", columnList = "createdAt"),
        @Index(name = "idx_trace_id", columnList = "traceId")
})
public class ConfigEventLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String eventId;

    @Column(nullable = false, length = 64)
    private String traceId;

    @Column(nullable = false, length = 64)
    @Enumerated(EnumType.STRING)
    private EventType eventType;

    @Column(nullable = false, length = 64)
    @Enumerated(EnumType.STRING)
    private EventLevel level;

    @Column(length = 128)
    private String entityId;

    @Column(length = 256)
    private String entityType;

    @Column(length = 512)
    private String message;

    @Column(columnDefinition = "TEXT")
    private String details;

    @Column(columnDefinition = "TEXT")
    private String stackTrace;

    @Column(length = 128)
    private String instanceId;

    @Column(length = 64)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public enum EventType {
        CONFIG_CREATE, CONFIG_UPDATE, CONFIG_DELETE, CONFIG_PUBLISH,
        CLIENT_CONNECT, CLIENT_DISCONNECT, CLIENT_SUBSCRIBE, CLIENT_UNSUBSCRIBE,
        PUSH_START, PUSH_SUCCESS, PUSH_FAILED, PUSH_RETRY, PUSH_TIMEOUT,
        CACHE_UPDATE, CACHE_INVALIDATE,
        RETRY_TRIGGER, ROLLBACK_START, ROLLBACK_COMPLETE, ROLLBACK_FAILED,
        SYSTEM_START, SYSTEM_ERROR, SYSTEM_WARNING
    }

    public enum EventLevel {
        DEBUG, INFO, WARN, ERROR, FATAL
    }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (level == null) level = EventLevel.INFO;
    }
}
