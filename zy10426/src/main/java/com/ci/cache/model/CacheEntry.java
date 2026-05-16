package com.ci.cache.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "cache_entries")
public class CacheEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String cacheKey;

    @Column(nullable = false)
    private String projectName;

    @Column(nullable = false)
    private Long hitCount = 0L;

    @Column(nullable = false)
    private Long sizeInBytes;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime lastAccessedAt;

    private String description;

    @Column(nullable = false)
    private Boolean active = true;

    public CacheEntry() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCacheKey() { return cacheKey; }
    public void setCacheKey(String cacheKey) { this.cacheKey = cacheKey; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public Long getHitCount() { return hitCount; }
    public void setHitCount(Long hitCount) { this.hitCount = hitCount; }
    public Long getSizeInBytes() { return sizeInBytes; }
    public void setSizeInBytes(Long sizeInBytes) { this.sizeInBytes = sizeInBytes; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getLastAccessedAt() { return lastAccessedAt; }
    public void setLastAccessedAt(LocalDateTime lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }

    public void incrementHitCount() {
        this.hitCount++;
        this.lastAccessedAt = LocalDateTime.now();
    }
}
