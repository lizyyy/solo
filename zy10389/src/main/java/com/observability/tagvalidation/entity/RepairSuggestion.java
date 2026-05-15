package com.observability.tagvalidation.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@Entity
@Table(name = "repair_suggestion", indexes = {
    @Index(name = "idx_violation_id", columnList = "violation_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = "violation")
public class RepairSuggestion extends BaseEntity {
    @Column(name = "suggestion", length = 2048, nullable = false)
    private String suggestion;

    @Column(name = "operation", length = 256)
    private String operation;

    @Column(name = "expected_value", length = 512)
    private String expectedValue;

    @Column(name = "priority", nullable = false)
    private Integer priority = 1;

    @Column(name = "applied", nullable = false)
    private Boolean applied = false;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "violation_id", nullable = false, unique = true)
    private ViolationRecord violation;
}
