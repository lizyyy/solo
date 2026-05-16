package com.dns.preplay.model.entity;

import com.dns.preplay.model.enums.RecordType;
import com.dns.preplay.model.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "diff_results")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DiffResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String domainName;

    @Enumerated(EnumType.STRING)
    private RecordType recordType;

    private String expectedTarget;

    private String actualTarget;

    private Boolean hasDifference;

    private Integer expectedTtl;

    private Integer actualTtl;

    @Enumerated(EnumType.STRING)
    private RiskLevel ttlRiskLevel;

    private String ttlRiskReason;

    private String differenceDescription;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preplay_id")
    private DnsPreplay preplay;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
