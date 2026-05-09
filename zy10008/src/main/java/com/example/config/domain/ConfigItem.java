package com.example.config.domain;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "config_item", indexes = {
        @Index(name = "idx_namespace_key", columnList = "namespace, configKey", unique = true),
        @Index(name = "idx_version", columnList = "version")
})
public class ConfigItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 128)
    private String namespace;

    @Column(nullable = false, length = 256, name = "config_key")
    private String configKey;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String configValue;

    @Column(nullable = false)
    private Long version;

    @Column(length = 256)
    private String description;

    @Column(nullable = false)
    private Boolean enabled;

    @Column(length = 64)
    private String createdBy;

    @Column(length = 64)
    private String updatedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (updatedAt == null) updatedAt = LocalDateTime.now();
        if (version == null) version = 1L;
        if (enabled == null) enabled = true;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
        if (version != null) {
            version = version + 1;
        }
    }
}
