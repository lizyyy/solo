package com.degrade.drill.model;

import com.degrade.drill.enums.DrillStatus;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "drill_plan")
public class DrillPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String requestId;

    @Column(nullable = false)
    private String planName;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
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

    private String createdBy;

    private LocalDateTime createdAt = LocalDateTime.now();

    private LocalDateTime updatedAt = LocalDateTime.now();

    private String errorMessage;
}