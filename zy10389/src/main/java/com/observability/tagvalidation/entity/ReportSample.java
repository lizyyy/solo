package com.observability.tagvalidation.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Data
@Entity
@Table(name = "report_sample", indexes = {
    @Index(name = "idx_sample_id", columnList = "sampleId", unique = true),
    @Index(name = "idx_api_sample", columnList = "api_info_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = "apiInfo")
public class ReportSample extends BaseEntity {
    @Column(name = "sample_id", nullable = false, unique = true, length = 64)
    private String sampleId;

    @Column(name = "source", length = 128)
    private String source;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "tags", columnDefinition = "json", nullable = false)
    private Map<String, String> tags;

    @Column(name = "validated", nullable = false)
    private Boolean validated = false;

    @Column(name = "has_violation", nullable = false)
    private Boolean hasViolation = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_info_id", nullable = false)
    private ApiInfo apiInfo;
}
