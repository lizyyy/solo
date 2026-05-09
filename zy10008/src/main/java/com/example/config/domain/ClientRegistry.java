package com.example.config.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "client_registry", indexes = {
        @Index(name = "idx_instance_id", columnList = "instanceId", unique = true),
        @Index(name = "idx_service_name", columnList = "serviceName"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_last_heartbeat", columnList = "lastHeartbeatAt")
})
public class ClientRegistry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 128)
    private String instanceId;

    @Column(nullable = false, length = 128)
    private String serviceName;

    @Column(length = 64)
    private String environment;

    @Column(length = 128)
    private String ipAddress;

    @Column
    private Integer port;

    @ElementCollection
    @CollectionTable(name = "client_subscriptions", joinColumns = @JoinColumn(name = "client_id"))
    @Column(name = "namespace")
    @Builder.Default
    private Set<String> subscriptions = new HashSet<>();

    @Column(nullable = false, length = 32)
    @Enumerated(EnumType.STRING)
    private ConnectionStatus status;

    @Column(length = 64)
    private String sessionId;

    @Column(columnDefinition = "TEXT")
    private String metadata;

    @Column(nullable = false)
    private LocalDateTime connectedAt;

    @Column
    private LocalDateTime disconnectedAt;

    @Column(nullable = false)
    private LocalDateTime lastHeartbeatAt;

    @Column
    private LocalDateTime lastPushAt;

    public enum ConnectionStatus {
        CONNECTED, DISCONNECTED, OFFLINE, STALE
    }

    @PrePersist
    protected void onCreate() {
        if (connectedAt == null) connectedAt = LocalDateTime.now();
        if (lastHeartbeatAt == null) lastHeartbeatAt = LocalDateTime.now();
        if (status == null) status = ConnectionStatus.CONNECTED;
    }
}
