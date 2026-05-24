package com.agri.dronespray.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "processing_record")
public class ProcessingRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "permission_id", nullable = false)
    private Permission permission;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private PermissionStatus fromStatus;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private PermissionStatus toStatus;

    @Column(length = 2000)
    private String action;

    @Column(length = 2000)
    private String remark;

    @Column(nullable = false)
    private LocalDateTime processedAt;

    @Column(nullable = false)
    private String processedBy;

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

    public PermissionStatus getFromStatus() {
        return fromStatus;
    }

    public void setFromStatus(PermissionStatus fromStatus) {
        this.fromStatus = fromStatus;
    }

    public PermissionStatus getToStatus() {
        return toStatus;
    }

    public void setToStatus(PermissionStatus toStatus) {
        this.toStatus = toStatus;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public LocalDateTime getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(LocalDateTime processedAt) {
        this.processedAt = processedAt;
    }

    public String getProcessedBy() {
        return processedBy;
    }

    public void setProcessedBy(String processedBy) {
        this.processedBy = processedBy;
    }

    @PrePersist
    protected void onCreate() {
        processedAt = LocalDateTime.now();
    }
}
