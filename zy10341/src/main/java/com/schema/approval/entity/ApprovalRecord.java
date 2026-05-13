package com.schema.approval.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Entity
@Table(name = "approval_record")
public class ApprovalRecord extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "schema_version_id", nullable = false)
    private SchemaVersion schemaVersion;

    @Column(name = "approver", nullable = false)
    private String approver;

    @Column(name = "approval_comment", length = 2000)
    private String approvalComment;

    @Column(name = "is_approved", nullable = false)
    private Boolean isApproved;

    @Column(name = "approval_step", nullable = false)
    private Integer approvalStep;

    @Column(name = "total_steps", nullable = false)
    private Integer totalSteps;
}
