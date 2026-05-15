package com.identity.verification.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "conflict_field")
public class ConflictField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "field_name", nullable = false, length = 100)
    private String fieldName;

    @Column(name = "source_a_code", length = 50)
    private String sourceACode;

    @Column(name = "source_a_value", length = 500)
    private String sourceAValue;

    @Column(name = "source_b_code", length = 50)
    private String sourceBCode;

    @Column(name = "source_b_value", length = 500)
    private String sourceBValue;

    @Column(length = 1000)
    private String description;

    @Column(name = "resolved")
    private Boolean resolved;

    @Column(name = "resolved_value", length = 500)
    private String resolvedValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (resolved == null) resolved = false;
    }
}
