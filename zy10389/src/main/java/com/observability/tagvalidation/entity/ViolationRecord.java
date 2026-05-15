package com.observability.tagvalidation.entity;

import com.observability.tagvalidation.enums.ViolationType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.ToString;

@Data
@Entity
@Table(name = "violation_record", indexes = {
    @Index(name = "idx_violation_type", columnList = "violationType"),
    @Index(name = "idx_api_violation", columnList = "api_info_id"),
    @Index(name = "idx_sample_violation", columnList = "sample_id")
})
@EqualsAndHashCode(callSuper = true)
@ToString(exclude = "apiInfo")
public class ViolationRecord extends BaseEntity {
    @Column(name = "sample_id", length = 64)
    private String sampleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "violation_type", nullable = false, length = 64)
    private ViolationType violationType;

    @Column(name = "tag_key", length = 128)
    private String tagKey;

    @Column(name = "tag_value", length = 512)
    private String tagValue;

    @Column(name = "detail", length = 2048)
    private String detail;

    @Column(name = "resolved", nullable = false)
    private Boolean resolved = false;

    @Column(name = "agg_count", nullable = false)
    private Integer aggCount = 1;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "api_info_id", nullable = false)
    private ApiInfo apiInfo;

    @OneToOne(mappedBy = "violation", cascade = CascadeType.ALL, orphanRemoval = true)
    private RepairSuggestion repairSuggestion;
}
