package com.hazardous.waste.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
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
}
