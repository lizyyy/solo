package com.approval.coordinator.model.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "timeline_events", indexes = {
    @Index(name = "idx_timeline_batch_id", columnList = "batch_id"),
    @Index(name = "idx_timeline_event_time", columnList = "event_time")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TimelineEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private ApprovalBatch batch;

    @Column(name = "item_id", length = 128)
    private String itemId;

    @Column(name = "event_type", length = 64, nullable = false)
    private String eventType;

    @Column(name = "event_time", nullable = false)
    private LocalDateTime eventTime;

    @Column(name = "operator", length = 128)
    private String operator;

    @Column(name = "source", length = 128)
    private String source;

    @Column(name = "description", length = 1024)
    private String description;

    @Column(name = "detail", columnDefinition = "TEXT")
    private String detail;

    @Column(name = "previous_status", length = 64)
    private String previousStatus;

    @Column(name = "new_status", length = 64)
    private String newStatus;

    @PrePersist
    protected void onCreate() {
        if (eventTime == null) {
            eventTime = LocalDateTime.now();
        }
    }
}
