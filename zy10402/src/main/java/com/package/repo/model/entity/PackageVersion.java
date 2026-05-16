package com.package.repo.model.entity;

import com.package.repo.model.enums.PackageStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "package_versions", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"packageName", "version"})
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String packageName;

    @Column(nullable = false, length = 100)
    private String version;

    @Column(nullable = false, length = 100)
    private String publisher;

    @Column(length = 500)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private PackageStatus status;

    @Column(nullable = false)
    private LocalDateTime publishTime;

    private LocalDateTime lastStatusChangeTime;

    @Column(length = 1000)
    private String statusChangeReason;

    @OneToMany(mappedBy = "packageVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<DependencyProject> dependencyProjects = new ArrayList<>();

    @OneToMany(mappedBy = "packageVersion", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<WithdrawRequest> withdrawRequests = new ArrayList<>();

    @Column(nullable = false)
    @Builder.Default
    private Boolean deleted = false;

    @Column(length = 500)
    private String rawInput;

    @PrePersist
    protected void onCreate() {
        if (publishTime == null) {
            publishTime = LocalDateTime.now();
        }
        if (status == null) {
            status = PackageStatus.PUBLISHED;
        }
        lastStatusChangeTime = LocalDateTime.now();
    }
}
