package com.package.repo.model.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "impact_reports")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImpactReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "withdraw_request_id", nullable = false)
    private WithdrawRequest withdrawRequest;

    @Column(nullable = false, length = 255)
    private String affectedProject;

    @Column(length = 100)
    private String projectOwner;

    @Column(length = 2000)
    private String impactDescription;

    @Column(nullable = false)
    private Integer impactLevel;

    @Column(nullable = false)
    private Boolean requiresCompensation;

    @Column(length = 1000)
    private String compensationSuggestion;

    private LocalDateTime generatedTime;

    @PrePersist
    protected void onCreate() {
        if (generatedTime == null) {
            generatedTime = LocalDateTime.now();
        }
    }
}
