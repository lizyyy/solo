package com.schema.approval.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "compatibility_check")
public class CompatibilityCheck extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schema_version_id", nullable = false)
    private SchemaVersion schemaVersion;

    @Column(name = "check_result", nullable = false)
    private Boolean checkResult;

    @Column(name = "check_details", columnDefinition = "TEXT")
    private String checkDetails;

    @Column(name = "compared_with_version")
    private Integer comparedWithVersion;

    @Column(name = "check_duration_ms")
    private Long checkDurationMs;

    @Column(name = "checker_service")
    private String checkerService;
}
