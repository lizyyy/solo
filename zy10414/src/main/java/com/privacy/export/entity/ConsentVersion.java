package com.privacy.export.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "consent_version")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsentVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String versionCode;

    @Column(nullable = false)
    private String versionName;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private LocalDateTime effectiveDate;

    private LocalDateTime expiryDate;

    @Column(nullable = false)
    private Boolean isActive;

    @Column(length = 5000)
    private String consentContent;

    private String legalReference;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isActive == null) {
            isActive = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
