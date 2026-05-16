package com.certificate.health.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "fix_suggestion")
public class FixSuggestion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "issue_type")
    private String issueType;

    @Column(name = "severity")
    private String severity;

    @Column(name = "suggestion", length = 2000)
    private String suggestion;

    @Column(name = "action_items", length = 3000)
    private String actionItems;

    @Column(name = "reference_links", length = 1000)
    private String referenceLinks;

    @Column(name = "is_fixed")
    private Boolean isFixed;

    @Column(name = "fixed_at")
    private LocalDateTime fixedAt;

    @Column(name = "fixed_by")
    private String fixedBy;

    @Column(name = "fix_notes", length = 2000)
    private String fixNotes;
}
