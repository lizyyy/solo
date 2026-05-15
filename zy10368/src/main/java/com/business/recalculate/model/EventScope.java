package com.business.recalculate.model;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "event_scope")
public class EventScope {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String scopeType;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @ElementCollection
    @CollectionTable(name = "scope_event_types", joinColumns = @JoinColumn(name = "scope_id"))
    @Column(name = "event_type")
    private List<String> eventTypes;

    @ElementCollection
    @CollectionTable(name = "scope_business_ids", joinColumns = @JoinColumn(name = "scope_id"))
    @Column(name = "business_id")
    private List<String> businessIds;

    @Column(length = 2000)
    private String filterExpression;

    private Integer estimatedEventCount;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
