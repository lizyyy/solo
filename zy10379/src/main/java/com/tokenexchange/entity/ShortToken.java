package com.tokenexchange.entity;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "short_token")
public class ShortToken {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 512)
    private String tokenValue;

    @Column(nullable = false, length = 128)
    private String userId;

    @Column(nullable = false, length = 64)
    private String sourceServiceId;

    @Column(nullable = false, length = 64)
    private String targetServiceId;

    @Column(length = 64)
    private String scenarioCode;

    @Column(length = 1024)
    private String scopes;

    @Column(nullable = false)
    private LocalDateTime issuedAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;

    @Column(nullable = false)
    private Boolean revoked = false;

    private LocalDateTime revokedAt;

    @Column(length = 256)
    private String revokeReason;

    @Column(nullable = false)
    private Integer useCount = 0;

    @Column(nullable = false)
    private Integer maxUseCount = 1;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(expiresAt);
    }

    public boolean isExhausted() {
        return useCount >= maxUseCount;
    }

    public boolean isValid() {
        return !revoked && !isExpired() && !isExhausted();
    }
}
