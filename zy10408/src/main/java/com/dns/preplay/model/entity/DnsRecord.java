package com.dns.preplay.model.entity;

import com.dns.preplay.model.enums.RecordType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "dns_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DnsRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String domainName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecordType recordType;

    private String oldTarget;

    private String newTarget;

    @Column(nullable = false)
    private Integer ttl;

    private Integer expectedTtl;

    private String ttlStrategy;

    private String comment;

    private Boolean isManualCorrected;

    private String originalInput;

    @Column(updatable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "preplay_id")
    private DnsPreplay preplay;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (isManualCorrected == null) {
            isManualCorrected = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
