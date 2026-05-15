package com.apidiff.entity;

import com.apidiff.entity.enums.DiffType;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "diff_fields", indexes = {
    @Index(name = "idx_diff_record_id", columnList = "diff_record_id"),
    @Index(name = "idx_field_path", columnList = "fieldPath")
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@ToString(exclude = "diffRecord")
public class DiffField {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "diff_record_id", nullable = false)
    private ApiDiffRecord diffRecord;

    @Column(nullable = false, length = 500)
    private String fieldPath;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DiffType diffType;

    @Column(columnDefinition = "TEXT")
    private String expectedValue;

    @Column(columnDefinition = "TEXT")
    private String actualValue;

    @Column(length = 100)
    private String expectedType;

    @Column(length = 100)
    private String actualType;

    @Column(length = 2000)
    private String attributionNote;

    @Column(length = 500)
    private String attributedBy;

    private LocalDateTime attributedAt;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
