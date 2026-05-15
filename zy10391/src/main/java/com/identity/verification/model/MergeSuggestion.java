package com.identity.verification.model;

import com.identity.verification.model.enums.TrustLevel;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "merge_suggestion")
public class MergeSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "task_id", nullable = false)
    private Long taskId;

    @Column(name = "field_name", nullable = false, length = 100)
    private String fieldName;

    @Column(name = "suggested_value", length = 500)
    private String suggestedValue;

    @Column(name = "suggested_source", length = 50)
    private String suggestedSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "trust_level", length = 20)
    private TrustLevel trustLevel;

    @Column(name = "confidence_score")
    private Integer confidenceScore;

    @Column(length = 1000)
    private String reasoning;

    @Column(name = "adopted")
    private Boolean adopted;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (adopted == null) adopted = false;
    }
}
