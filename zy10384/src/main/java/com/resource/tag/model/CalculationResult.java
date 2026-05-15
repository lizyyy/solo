package com.resource.tag.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "calculation_results")
public class CalculationResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String taskId;

    @Column(nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String tagKey;

    @Column(nullable = false)
    private String tagValue;

    private String sourceNodeId;

    private Boolean isInherited = false;

    private Integer priority;

    private LocalDateTime calculatedAt;

    @PrePersist
    protected void onCreate() {
        calculatedAt = LocalDateTime.now();
    }
}
