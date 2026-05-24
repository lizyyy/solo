package com.agri.dronespray.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "amendment_history")
public class AmendmentHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Column(length = 2000)
    private String oldConclusion;

    @Column(length = 2000)
    private String newConclusion;

    @Column(length = 2000)
    private String amendmentReason;

    private String amendedField;

    @Column(nullable = false)
    private LocalDateTime amendedAt;

    @Column(nullable = false)
    private String amendedBy;

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

    public String getOldConclusion() {
        return oldConclusion;
    }

    public void setOldConclusion(String oldConclusion) {
        this.oldConclusion = oldConclusion;
    }

    public String getNewConclusion() {
        return newConclusion;
    }

    public void setNewConclusion(String newConclusion) {
        this.newConclusion = newConclusion;
    }

    public String getAmendmentReason() {
        return amendmentReason;
    }

    public void setAmendmentReason(String amendmentReason) {
        this.amendmentReason = amendmentReason;
    }

    public String getAmendedField() {
        return amendedField;
    }

    public void setAmendedField(String amendedField) {
        this.amendedField = amendedField;
    }

    public LocalDateTime getAmendedAt() {
        return amendedAt;
    }

    public void setAmendedAt(LocalDateTime amendedAt) {
        this.amendedAt = amendedAt;
    }

    public String getAmendedBy() {
        return amendedBy;
    }

    public void setAmendedBy(String amendedBy) {
        this.amendedBy = amendedBy;
    }

    @PrePersist
    protected void onCreate() {
        amendedAt = LocalDateTime.now();
    }
}
