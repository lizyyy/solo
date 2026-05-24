package com.hazardous.waste.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "alert_record")
public class AlertRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String alertType;

    @Column(nullable = false)
    private String alertLevel;

    @Column(nullable = false)
    private String relatedRecordNo;

    @Column(length = 2000)
    private String alertContent;

    @Column(nullable = false)
    private Boolean isRead;

    @Column(nullable = false)
    private Boolean isHandled;

    private String handler;

    private LocalDateTime handleTime;

    @Column(length = 2000)
    private String handleRemark;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isRead == null) isRead = false;
        if (isHandled == null) isHandled = false;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getAlertType() { return alertType; }
    public void setAlertType(String alertType) { this.alertType = alertType; }
    public String getAlertLevel() { return alertLevel; }
    public void setAlertLevel(String alertLevel) { this.alertLevel = alertLevel; }
    public String getRelatedRecordNo() { return relatedRecordNo; }
    public void setRelatedRecordNo(String relatedRecordNo) { this.relatedRecordNo = relatedRecordNo; }
    public String getAlertContent() { return alertContent; }
    public void setAlertContent(String alertContent) { this.alertContent = alertContent; }
    public Boolean getIsRead() { return isRead; }
    public void setIsRead(Boolean isRead) { this.isRead = isRead; }
    public Boolean getIsHandled() { return isHandled; }
    public void setIsHandled(Boolean isHandled) { this.isHandled = isHandled; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
    public LocalDateTime getHandleTime() { return handleTime; }
    public void setHandleTime(LocalDateTime handleTime) { this.handleTime = handleTime; }
    public String getHandleRemark() { return handleRemark; }
    public void setHandleRemark(String handleRemark) { this.handleRemark = handleRemark; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
