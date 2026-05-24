package com.school.canteen.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "replacement_requests")
public class ReplacementRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String requestNo;

    @Column(nullable = false)
    private LocalDate mealDate;

    @Column(nullable = false, length = 20)
    private String mealType;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_dish_id", nullable = false)
    private Dish originalDish;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replacement_dish_id", nullable = false)
    private Dish replacementDish;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ReplacementStatus status;

    @Column(length = 1000)
    private String reason;

    @Column(length = 2000)
    private String conflictDetails;

    @Column(length = 2000)
    private String validationNotes;

    @ManyToMany
    @JoinTable(
        name = "replacement_affected_students",
        joinColumns = @JoinColumn(name = "replacement_id"),
        inverseJoinColumns = @JoinColumn(name = "student_id")
    )
    private Set<Student> affectedStudents = new HashSet<>();

    @Column(nullable = false)
    private Boolean locked = false;

    @Column(length = 100)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 100)
    private String updatedBy;

    private LocalDateTime updatedAt;

    @Column(length = 100)
    private String reviewedBy;

    private LocalDateTime reviewedAt;

    @Column(length = 100)
    private String revokedBy;

    private LocalDateTime revokedAt;

    @Version
    private Long version;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRequestNo() { return requestNo; }
    public void setRequestNo(String requestNo) { this.requestNo = requestNo; }
    public LocalDate getMealDate() { return mealDate; }
    public void setMealDate(LocalDate mealDate) { this.mealDate = mealDate; }
    public String getMealType() { return mealType; }
    public void setMealType(String mealType) { this.mealType = mealType; }
    public Dish getOriginalDish() { return originalDish; }
    public void setOriginalDish(Dish originalDish) { this.originalDish = originalDish; }
    public Dish getReplacementDish() { return replacementDish; }
    public void setReplacementDish(Dish replacementDish) { this.replacementDish = replacementDish; }
    public ReplacementStatus getStatus() { return status; }
    public void setStatus(ReplacementStatus status) { this.status = status; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getConflictDetails() { return conflictDetails; }
    public void setConflictDetails(String conflictDetails) { this.conflictDetails = conflictDetails; }
    public String getValidationNotes() { return validationNotes; }
    public void setValidationNotes(String validationNotes) { this.validationNotes = validationNotes; }
    public Set<Student> getAffectedStudents() { return affectedStudents; }
    public void setAffectedStudents(Set<Student> affectedStudents) { this.affectedStudents = affectedStudents; }
    public Boolean getLocked() { return locked; }
    public void setLocked(Boolean locked) { this.locked = locked; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public String getRevokedBy() { return revokedBy; }
    public void setRevokedBy(String revokedBy) { this.revokedBy = revokedBy; }
    public LocalDateTime getRevokedAt() { return revokedAt; }
    public void setRevokedAt(LocalDateTime revokedAt) { this.revokedAt = revokedAt; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
