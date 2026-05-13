package com.api.inspection.entity;

import com.api.inspection.enums.TransactionStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "step_execution")
public class StepExecution {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ExecutionBatch batch;

    @Column(nullable = false)
    private Long stepId;

    @Column(nullable = false)
    private Integer stepOrder;

    @Column(nullable = false)
    private String stepName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransactionStatus status;

    @Column
    private LocalDateTime startTime;

    @Column
    private LocalDateTime endTime;

    @Column
    private Long duration;

    @Column
    private Integer statusCode;

    @Column(columnDefinition = "TEXT")
    private String responseBody;

    @Column(columnDefinition = "TEXT")
    private String responseHeaders;

    @Column(columnDefinition = "TEXT")
    private String extractedVariables;

    @Column(length = 1000)
    private String errorMessage;

    @OneToMany(mappedBy = "stepExecution", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<AssertionResult> assertionResults = new ArrayList<>();

    @OneToMany(mappedBy = "stepExecution", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<FailureLocation> failureLocations = new ArrayList<>();
}
