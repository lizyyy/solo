package com.degrade.drill.model;

import com.degrade.drill.enums.DrillStatus;
import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "drill_plan")
public class DrillPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 100)
    private String requestId;

    @Column(nullable = false, length = 200)
    private String planName;

    @Column(length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private DrillStatus status = DrillStatus.CREATED;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "target_api_id")
    private TargetApi targetApi;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "fallback_response_id")
    private FallbackResponse fallbackResponse;

    @ManyToOne(cascade = CascadeType.ALL)
    @JoinColumn(name = "stop_condition_id")
    private StopCondition stopCondition;

    private LocalDateTime scheduledStartTime;

    private LocalDateTime actualStartTime;

    private LocalDateTime endTime;

    @Column(length = 100)
    private String createdBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @Column(length = 1000)
    private String errorMessage;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (updatedAt == null) {
            updatedAt = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}