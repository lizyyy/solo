package com.dns.preplay.model.entity;

import com.dns.preplay.model.enums.PreplayStatus;
import com.dns.preplay.model.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "dns_preplays")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DnsPreplay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String preplayName;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PreplayStatus status;

    @Enumerated(EnumType.STRING)
    private RiskLevel overallRiskLevel;

    private String conclusion;

    private String rollbackNotes;

    private String createdBy;

    private String errorDetails;

    private String originalRequest;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime completedAt;

    @OneToMany(mappedBy = "preplay", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DnsRecord> records = new ArrayList<>();

    @OneToMany(mappedBy = "preplay", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DiffResult> diffResults = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = PreplayStatus.CREATED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public void addRecord(DnsRecord record) {
        records.add(record);
        record.setPreplay(this);
    }

    public void addDiffResult(DiffResult diff) {
        diffResults.add(diff);
        diff.setPreplay(this);
    }
}
