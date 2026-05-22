package com.tea.compensation.entity;

import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "audit_history", indexes = {
    @Index(name = "idx_task_id", columnList = "taskId"),
    @Index(name = "idx_batch_no", columnList = "batchNo"),
    @Index(name = "idx_field_name", columnList = "fieldName"),
    @Index(name = "idx_modified_at", columnList = "modifiedAt")
})
public class AuditHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long taskId;

    @Column(nullable = false, length = 64)
    private String batchNo;

    @Column(nullable = false, length = 100)
    private String fieldName;

    @Column(length = 100)
    private String fieldLabel;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String oldValue;

    @Lob
    @Column(columnDefinition = "TEXT")
    private String newValue;

    @Column(nullable = false, length = 64)
    private String modifiedBy;

    @Column(length = 100)
    private String modifiedByName;

    @CreationTimestamp
    @Column(nullable = false)
    private LocalDateTime modifiedAt;

    @Column(length = 500)
    private String changeReason;
}
