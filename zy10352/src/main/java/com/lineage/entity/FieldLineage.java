package com.lineage.entity;

import com.lineage.enums.FieldType;
import com.lineage.enums.LineageStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "field_lineage", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"api_path", "response_field"})
})
public class FieldLineage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "api_path", nullable = false)
    private String apiPath;

    @Column(name = "api_method", nullable = false)
    private String apiMethod;

    @Column(name = "api_name")
    private String apiName;

    @Column(name = "response_field", nullable = false)
    private String responseField;

    @Column(name = "field_path")
    private String fieldPath;

    @Enumerated(EnumType.STRING)
    @Column(name = "field_type")
    private FieldType fieldType;

    @Column(name = "description")
    private String description;

    @Column(name = "example_value")
    private String exampleValue;

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "lineage_source_table",
            joinColumns = @JoinColumn(name = "lineage_id"),
            inverseJoinColumns = @JoinColumn(name = "source_table_id")
    )
    private List<SourceTable> sourceTables = new ArrayList<>();

    @ManyToOne(cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinColumn(name = "calculation_rule_id")
    private CalculationRule calculationRule;

    @ManyToMany(cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "lineage_dependent_api",
            joinColumns = @JoinColumn(name = "lineage_id"),
            inverseJoinColumns = @JoinColumn(name = "dependent_api_id")
    )
    private List<DependentApi> dependentApis = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LineageStatus status;

    @Column(name = "created_by", nullable = false)
    private String createdBy;

    @Column(name = "updated_by")
    private String updatedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = LineageStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
