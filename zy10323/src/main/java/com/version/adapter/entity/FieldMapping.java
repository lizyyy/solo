package com.version.adapter.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "field_mapping")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FieldMapping {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long templateId;

    @Column(nullable = false)
    private String sourceField;

    @Column(nullable = false)
    private String targetField;

    @Column(nullable = false)
    private String fieldType;

    private String transformationRule;

    private Boolean isRequired;

    @Column(nullable = false)
    private Integer sortOrder;

    @Column(nullable = false)
    private Boolean isActive;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private String updatedBy;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isActive == null) {
            isActive = true;
        }
        if (isRequired == null) {
            isRequired = false;
        }
        if (sortOrder == null) {
            sortOrder = 0;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
