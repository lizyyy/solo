package com.identity.verification.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "confirmation_record")
public class ConfirmationRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "operator_id", length = 50)
    private String operatorId;

    @Column(name = "operator_name", length = 100)
    private String operatorName;

    @Column(length = 2000)
    private String comments;

    @Column(name = "conflict_field_id")
    private Long conflictFieldId;

    @Column(name = "field_name", length = 100)
    private String fieldName;

    @Column(name = "final_value", length = 500)
    private String finalValue;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
