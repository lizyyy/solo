package com.package.repo.model.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "dependency_projects")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DependencyProject {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "package_version_id", nullable = false)
    private PackageVersion packageVersion;

    @Column(nullable = false, length = 255)
    private String projectName;

    @Column(length = 100)
    private String projectOwner;

    @Column(length = 500)
    private String usageDescription;

    @Column(nullable = false)
    @Builder.Default
    private Boolean isActive = true;

    private LocalDateTime discoveredTime;

    @PrePersist
    protected void onCreate() {
        if (discoveredTime == null) {
            discoveredTime = LocalDateTime.now();
        }
    }
}
