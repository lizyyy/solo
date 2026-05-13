package com.example.readonlywindow.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "timeline_events")
public class TimelineEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String eventCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventType eventType;

    private Long windowId;

    private Long requestId;

    private Long credentialId;

    private Long conflictId;

    @Column(nullable = false)
    private LocalDateTime eventTime;

    private String operator;

    @Column(length = 2000)
    private String description;

    @Column(length = 4000)
    private String details;
}
