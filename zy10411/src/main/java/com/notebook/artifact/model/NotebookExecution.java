package com.notebook.artifact.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "notebook_executions")
public class NotebookExecution {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String executionId;

    @Column(nullable = false)
    private String notebookIdentifier;

    @Column
    private String notebookName;

    @Column
    private String notebookPath;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "parameter_set_id")
    private ParameterSet parameterSet;

    @OneToOne(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "runtime_env_id")
    private RuntimeEnvironment runtimeEnvironment;

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "execution_id")
    private List<OutputArtifact> outputArtifacts = new ArrayList<>();

    @OneToMany(cascade = CascadeType.ALL, orphanRemoval = true)
    @JoinColumn(name = "execution_id")
    private List<ReviewOpinion> reviewOpinions = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExecutionStatus status = ExecutionStatus.CREATED;

    @Enumerated(EnumType.STRING)
    @Column
    private ReviewStatus reviewStatus = ReviewStatus.PENDING;

    @Column
    private Integer version = 1;

    @Column
    private String executedBy;

    @Column
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime startedAt;

    @Column
    private LocalDateTime completedAt;

    @Column
    private LocalDateTime archivedAt;

    @Column(length = 1000)
    private String executionLog;

    @Column
    private Boolean archived = false;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (executionId == null) {
            executionId = "NB-" + System.currentTimeMillis() + "-" + 
                         notebookIdentifier.replaceAll("[^a-zA-Z0-9]", "").substring(0, 8);
        }
    }

    public void addOutputArtifact(OutputArtifact artifact) {
        outputArtifacts.add(artifact);
    }

    public void addReviewOpinion(ReviewOpinion opinion) {
        reviewOpinions.add(opinion);
        reviewStatus = opinion.getStatus();
        if (status == ExecutionStatus.NEEDS_REVIEW) {
            status = ExecutionStatus.REVIEWED;
        }
    }
}
