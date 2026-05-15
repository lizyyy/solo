package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import com.object.lifecycle.enums.RuleStatus;
import javax.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(name = "lifecycle_rule")
@Getter
@Setter
public class LifecycleRule extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String ruleId;

    @Column(nullable = false)
    private String ruleName;

    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prefix_id", nullable = false)
    private ObjectPrefix objectPrefix;

    @Column(nullable = false)
    private Integer archiveAfterDays;

    @Column(nullable = false)
    private Integer deleteAfterDays;

    private String storageClass;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RuleStatus status = RuleStatus.DRAFT;

    private LocalDateTime effectiveFrom;

    private LocalDateTime effectiveTo;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Version
    private Long version;
}
