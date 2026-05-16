package com.diagnostic.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "service_instance")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ServiceInstance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", nullable = false, unique = true, length = 128)
    private String instanceId;

    @Column(name = "service_name", nullable = false, length = 64)
    private String serviceName;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "port")
    private Integer port;

    @Column(name = "environment", length = 32)
    private String environment;

    @Column(name = "status", length = 32)
    private String status;

    @Column(name = "last_heartbeat")
    private LocalDateTime lastHeartbeat;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}