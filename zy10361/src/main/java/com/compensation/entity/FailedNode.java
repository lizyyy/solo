package com.compensation.entity;

import com.compensation.enums.NodeStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "failed_node", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"process_id", "node_id"})
})
public class FailedNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "process_id", nullable = false, length = 64)
    private String processId;

    @Column(name = "node_id", nullable = false, length = 64)
    private String nodeId;

    @Column(name = "node_name", nullable = false, length = 128)
    private String nodeName;

    @Column(name = "service_name", nullable = false, length = 64)
    private String serviceName;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "failed_at")
    private LocalDateTime failedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private NodeStatus status;

    @PrePersist
    protected void onCreate() {
        failedAt = LocalDateTime.now();
    }
}
