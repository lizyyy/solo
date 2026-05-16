package com.notebook.artifact.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "review_opinions")
public class ReviewOpinion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String reviewer;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReviewStatus status;

    @Column(length = 2000)
    private String comments;

    @Column
    private LocalDateTime reviewedAt;

    @Column
    private String correctionSuggestions;
}
