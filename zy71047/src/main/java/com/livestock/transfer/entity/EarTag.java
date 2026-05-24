package com.livestock.transfer.entity;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "ear_tag")
public class EarTag {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tag_no", nullable = false, unique = true)
    private String tagNo;

    @Column(name = "cattle_type")
    private String cattleType;

    @Column(name = "breed")
    private String breed;

    @Column(name = "gender")
    private String gender;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "origin_farm_id")
    private Long originFarmId;

    @Column(name = "current_farm_id")
    private Long currentFarmId;

    @Column(name = "status")
    private String status = "NORMAL";

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTagNo() { return tagNo; }
    public void setTagNo(String tagNo) { this.tagNo = tagNo; }
    public String getCattleType() { return cattleType; }
    public void setCattleType(String cattleType) { this.cattleType = cattleType; }
    public String getBreed() { return breed; }
    public void setBreed(String breed) { this.breed = breed; }
    public String getGender() { return gender; }
    public void setGender(String gender) { this.gender = gender; }
    public LocalDate getBirthDate() { return birthDate; }
    public void setBirthDate(LocalDate birthDate) { this.birthDate = birthDate; }
    public Long getOriginFarmId() { return originFarmId; }
    public void setOriginFarmId(Long originFarmId) { this.originFarmId = originFarmId; }
    public Long getCurrentFarmId() { return currentFarmId; }
    public void setCurrentFarmId(Long currentFarmId) { this.currentFarmId = currentFarmId; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
