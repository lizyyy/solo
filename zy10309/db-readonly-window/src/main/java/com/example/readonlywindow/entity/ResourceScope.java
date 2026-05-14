package com.example.readonlywindow.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "resource_scopes")
public class ResourceScope {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "window_id", nullable = false)
    private FreezeWindow freezeWindow;

    @Column(nullable = false)
    private String resourceType;

    @Column(nullable = false)
    private String resourceName;

    private String schemaName;

    private String tableName;

    private String createdBy;

    private LocalDateTime createdAt;
}
