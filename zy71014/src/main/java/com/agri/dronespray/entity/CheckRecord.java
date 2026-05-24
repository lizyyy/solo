package com.agri.dronespray.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "check_record")
public class CheckRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private CheckType checkType;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private CheckResult checkResult;

    @Column(length = 2000)
    private String checkDetail;

    @Column(length = 2000)
    private String disposalInstruction;

    private Long relatedItemId;

    @Column(nullable = false)
    private LocalDateTime checkedAt;

    private String checkedBy;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Permission getPermission() {
        return permission;
    }

    public void setPermission(Permission permission) {
        this.permission = permission;
    }

    public CheckType getCheckType() {
        return checkType;
    }

    public void setCheckType(CheckType checkType) {
        this.checkType = checkType;
    }

    public CheckResult getCheckResult() {
        return checkResult;
    }

    public void setCheckResult(CheckResult checkResult) {
        this.checkResult = checkResult;
    }

    public String getCheckDetail() {
        return checkDetail;
    }

    public void setCheckDetail(String checkDetail) {
        this.checkDetail = checkDetail;
    }

    public String getDisposalInstruction() {
        return disposalInstruction;
    }

    public void setDisposalInstruction(String disposalInstruction) {
        this.disposalInstruction = disposalInstruction;
    }

    public Long getRelatedItemId() {
        return relatedItemId;
    }

    public void setRelatedItemId(Long relatedItemId) {
        this.relatedItemId = relatedItemId;
    }

    public LocalDateTime getCheckedAt() {
        return checkedAt;
    }

    public void setCheckedAt(LocalDateTime checkedAt) {
        this.checkedAt = checkedAt;
    }

    public String getCheckedBy() {
        return checkedBy;
    }

    public void setCheckedBy(String checkedBy) {
        this.checkedBy = checkedBy;
    }

    @PrePersist
    protected void onCreate() {
        checkedAt = LocalDateTime.now();
    }
}
