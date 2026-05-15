package com.resource.tag.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "change_history")
public class ChangeHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String tagKey;

    private String oldValue;

    private String newValue;

    private String operationType;

    private String operator;

    @Column(columnDefinition = "TEXT")
    private String changeDetails;

    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
