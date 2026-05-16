package com.notebook.artifact.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "output_artifacts")
public class OutputArtifact {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String artifactName;

    @Column(nullable = false)
    private String artifactType;

    @Column(length = 2000)
    private String artifactPath;

    @Column
    private Long fileSize;

    @Column
    private String fileHash;

    @Column
    private Integer version = 1;

    @Column
    private LocalDateTime generatedAt;

    @Column(length = 1000)
    private String description;
}
