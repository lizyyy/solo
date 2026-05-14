package com.compensation.entity;

import com.compensation.enums.ProcessStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "business_process")
public class BusinessProcess {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_id", unique = true, nullable = false, length = 64)
    private String processId;

    @Column(name = "process_name", nullable = false, length = 128)
    private String processName;

    @Column(name = "service_name", nullable = false, length = 64)
    private String serviceName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ProcessStatus status;

    @Column(name = "total_nodes")
    private Integer totalNodes = 0;

    @Column(name = "failed_nodes")
    private Integer failedNodes = 0;

    @Column(name = "created_at")
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
