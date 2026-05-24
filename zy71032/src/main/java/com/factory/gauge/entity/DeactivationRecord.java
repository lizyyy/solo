package com.factory.gauge.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "deactivation_record", indexes = {
    @Index(name = "idx_deact_tool_id", columnList = "toolId"),
    @Index(name = "idx_deact_is_active", columnList = "isActive")
})
public class DeactivationRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long toolId;

    @Column(length = 50)
    private String toolNo;

    @Column(nullable = false, length = 200)
    private String reason;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false, length = 100)
    private String operator;

    private LocalDateTime deactivatedAt;

    private LocalDateTime reactivatedAt;

    @Column(length = 100)
    private String reactivatedBy;

    @Column(length = 500)
    private String reactivationRemark;

    @Column(nullable = false)
    private Boolean isActive = true;

    @Column(length = 500)
    private String remarks;

    @Column(length = 100)
    private String createdBy;

    @Column(length = 100)
    private String updatedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Integer version;
}
