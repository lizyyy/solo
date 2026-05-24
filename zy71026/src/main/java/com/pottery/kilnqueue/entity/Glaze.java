package com.pottery.kilnqueue.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "glazes")
public class Glaze {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    @Column(nullable = false)
    private String name;

    private String brand;

    @Column(columnDefinition = "TEXT")
    private String conflictGlazes;

    private Integer minTemp;

    private Integer maxTemp;

    @Column(columnDefinition = "TEXT")
    private String notes;

    private Boolean active = true;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Transient
    public Set<String> getConflictGlazeSet() {
        Set<String> set = new HashSet<>();
        if (conflictGlazes != null && !conflictGlazes.isEmpty()) {
            String[] codes = conflictGlazes.split(",");
            for (String code : codes) {
                set.add(code.trim());
            }
        }
        return set;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBrand() { return brand; }
    public void setBrand(String brand) { this.brand = brand; }
    public String getConflictGlazes() { return conflictGlazes; }
    public void setConflictGlazes(String conflictGlazes) { this.conflictGlazes = conflictGlazes; }
    public Integer getMinTemp() { return minTemp; }
    public void setMinTemp(Integer minTemp) { this.minTemp = minTemp; }
    public Integer getMaxTemp() { return maxTemp; }
    public void setMaxTemp(Integer maxTemp) { this.maxTemp = maxTemp; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
