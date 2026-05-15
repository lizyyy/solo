package com.tokenexchange.entity;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "timeline_event")
public class TimelineEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 128)
    private String eventType;

    @Column(nullable = false, length = 512)
    private String entityId;

    @Column(length = 64)
    private String entityType;

    @Column(length = 1024)
    private String description;

    @Column(length = 2048)
    private String eventData;

    @Column(length = 128)
    private String operatorId;

    @Column(length = 64)
    private String operatorType;

    @Column(length = 1024)
    private String requestId;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
        createdAt = LocalDateTime.now();
    }
}
