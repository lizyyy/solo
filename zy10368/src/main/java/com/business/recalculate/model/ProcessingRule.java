package com.business.recalculate.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
@Entity
@Table(name = "processing_rule")
public class ProcessingRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String ruleCode;

    @Column(nullable = false)
    private String ruleName;

    @Column(nullable = false)
    private String ruleVersion;

    @Column(length = 2000)
    private String ruleDescription;

    @ElementCollection
    @CollectionTable(name = "rule_parameters", joinColumns = @JoinColumn(name = "rule_id"))
    @MapKeyColumn(name = "param_key")
    @Column(name = "param_value", length = 1000)
    private Map<String, String> parameters;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private String createdBy;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        enabled = true;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
