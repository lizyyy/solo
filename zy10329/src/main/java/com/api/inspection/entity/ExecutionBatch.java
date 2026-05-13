package com.api.inspection.entity;

import com.api.inspection.enums.TransactionStatus;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "execution_batch")
public class ExecutionBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String batchNo;

    @Column(nullable = false)
    private Long templateId;

    @Column(nullable = false)
    private String templateName;

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
    private Integer totalSteps;

    @Column
    private Integer successSteps;

    @Column
    private Integer failedSteps;

    @Column(columnDefinition = "TEXT")
    private String variables;

    @Column(length = 1000)
    private String errorMessage;

    @Column(nullable = false)
    private String executedBy;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("stepOrder ASC")
    private List<StepExecution> stepExecutions = new ArrayList<>();

    @Version
    private Long version;
}
