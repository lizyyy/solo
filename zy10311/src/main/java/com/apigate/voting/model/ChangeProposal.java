package com.apigate.voting.model;

import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "change_proposals")
public class ChangeProposal {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String proposalNo;

    @Column(nullable = false)
    private String title;

    @Column(length = 4000)
    private String description;

    @Column(nullable = false)
    private String apiName;

    private String apiVersion;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ChangeType changeType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitter_id", nullable = false)
    private Caller submitter;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ProposalStatus status;

    private LocalDateTime submittedAt;

    private LocalDateTime votingStartTime;

    private LocalDateTime votingEndTime;

    private LocalDateTime approvedAt;

    private LocalDateTime releasedAt;

    @Column(nullable = false)
    private Integer votingDurationHours = 24;

    private Integer approveThreshold = 2;

    @OneToMany(mappedBy = "proposal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ImpactItem> impactItems = new ArrayList<>();

    @OneToMany(mappedBy = "proposal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VoteOpinion> voteOpinions = new ArrayList<>();

    @OneToMany(mappedBy = "proposal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BlockReason> blockReasons = new ArrayList<>();

    @OneToMany(mappedBy = "proposal", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ReleaseRecord> releaseRecords = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = ProposalStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
