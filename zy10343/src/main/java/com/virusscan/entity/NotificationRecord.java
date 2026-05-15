package com.virusscan.entity;

import com.virusscan.enums.NotificationStatus;
import com.virusscan.enums.NotificationType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "notification_records", indexes = {
    @Index(name = "idx_notification_task_id", columnList = "taskId"),
    @Index(name = "idx_notification_status", columnList = "status"),
    @Index(name = "idx_notification_time", columnList = "createTime")
})
public class NotificationRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String notificationId;

    @Column(length = 64)
    private String taskId;

    @Column(length = 64)
    private String fileId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationType notificationType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationStatus status;

    @Column(nullable = false, length = 500)
    private String recipient;

    @Column(length = 1000)
    private String subject;

    @Column(length = 4000)
    private String content;

    @Column(length = 2000)
    private String errorMessage;

    private Integer retryCount = 0;

    private LocalDateTime sentTime;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createTime;

    @UpdateTimestamp
    private LocalDateTime updateTime;
}