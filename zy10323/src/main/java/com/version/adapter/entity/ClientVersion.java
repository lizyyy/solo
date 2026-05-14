package com.version.adapter.entity;

import com.version.adapter.entity.enums.VersionStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "client_version")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ClientVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String versionNumber;

    @Column(nullable = false)
    private String clientType;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private VersionStatus status;

    @Column(nullable = false)
    private Boolean isDeprecated;

    private String deprecatedReason;

    private LocalDateTime deprecatedAt;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private String updatedBy;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isDeprecated == null) {
            isDeprecated = false;
        }
        if (status == null) {
            status = VersionStatus.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
