package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "slow_requests")
@Data
@EqualsAndHashCode(callSuper = true)
public class SlowRequest extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "request_id")
    private String requestId;

    @Column(name = "http_method")
    private String httpMethod;

    @Column(name = "uri")
    private String uri;

    @Column(name = "query_string", columnDefinition = "TEXT")
    private String queryString;

    @Column(name = "request_headers", columnDefinition = "TEXT")
    private String requestHeaders;

    @Column(name = "request_body", columnDefinition = "TEXT")
    private String requestBody;

    @Column(name = "response_status")
    private Integer responseStatus;

    @Column(name = "response_headers", columnDefinition = "TEXT")
    private String responseHeaders;

    @Column(name = "response_body", columnDefinition = "TEXT")
    private String responseBody;

    @Column(name = "total_duration_ms")
    private Long totalDurationMs;

    @Column(name = "queue_duration_ms")
    private Long queueDurationMs;

    @Column(name = "processing_duration_ms")
    private Long processingDurationMs;

    @Column(name = "io_duration_ms")
    private Long ioDurationMs;

    @Column(name = "network_duration_ms")
    private Long networkDurationMs;

    @Column(name = "thread_name")
    private String threadName;

    @Column(name = "thread_id")
    private Long threadId;

    @Column(name = "client_ip")
    private String clientIp;

    @Column(name = "server_ip")
    private String serverIp;

    @Column(name = "server_port")
    private Integer serverPort;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity")
    private BottleneckSeverity severity;

    @Column(name = "evidence_snippet", columnDefinition = "TEXT")
    private String evidenceSnippet;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private Incident incident;
}
