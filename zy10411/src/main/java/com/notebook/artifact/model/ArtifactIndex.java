package com.notebook.artifact.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Entity
@Table(name = "artifact_indices")
public class ArtifactIndex {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String indexId;

    @Column(nullable = false)
    private String notebookIdentifier;

    @ElementCollection
    @CollectionTable(name = "index_tags", joinColumns = @JoinColumn(name = "index_id"))
    @Column(name = "tag")
    private List<String> tags;

    @Column
    private String createdBy;

    @Column
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime exportedAt;

    @Column(length = 1000)
    private String exportPath;

    @Column
    private Integer version = 1;
}
