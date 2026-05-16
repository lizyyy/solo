package com.privacy.export.entity;

import com.privacy.export.enums.ExportScopeCategory;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "export_scope_item")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExportScopeItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "export_request_id", nullable = false)
    private ExportRequest exportRequest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExportScopeCategory category;

    @Column(nullable = false)
    private String categoryName;

    @Column(nullable = false)
    private String fieldName;

    @Column(length = 2000)
    private String fieldDescription;

    @Column(nullable = false)
    private Boolean isIncluded;

    private String validationRule;

    @Column(length = 2000)
    private String validationNotes;

    private LocalDateTime validatedAt;

    private String validatedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (isIncluded == null) {
            isIncluded = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
