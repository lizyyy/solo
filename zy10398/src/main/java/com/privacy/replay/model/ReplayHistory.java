package com.privacy.replay.model;

import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "replay_history")
public class ReplayHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String requestId;

    @Column(nullable = false)
    private String requesterId;

    @Column(nullable = false)
    private String sampleIds;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MaskingLevel maskingLevel;

    @Column(nullable = false)
    private BigDecimal budgetCost;

    @Column(columnDefinition = "TEXT")
    private String resultData;

    @Column(nullable = false)
    private LocalDateTime executedAt;

    private Boolean success = true;

    private String errorMessage;
}
