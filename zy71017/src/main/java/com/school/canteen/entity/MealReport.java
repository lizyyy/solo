package com.school.canteen.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "meal_reports")
public class MealReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String reportNo;

    @Column(nullable = false)
    private LocalDate mealDate;

    @Column(nullable = false, length = 20)
    private String mealType;

    @Column(nullable = false)
    private Integer totalStudents;

    @Column(nullable = false)
    private Integer affectedStudentsCount;

    @Column(nullable = false)
    private Integer confirmedCount;

    @Column(nullable = false)
    private Integer pendingConfirmationCount;

    @Column(nullable = false)
    private Integer rejectedCount;

    @Column(nullable = false)
    private Integer replacementCount;

    @Column(nullable = false)
    private Integer allergenConflictCount;

    @Column(length = 5000)
    private String reportContent;

    @Column(length = 2000)
    private String notes;

    @Column(length = 100)
    private String generatedBy;

    @Column(nullable = false)
    private LocalDateTime generatedAt;

    @Column(length = 100)
    private String reviewedBy;

    private LocalDateTime reviewedAt;

    @Column(nullable = false)
    private Boolean finalized = false;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getReportNo() { return reportNo; }
    public void setReportNo(String reportNo) { this.reportNo = reportNo; }
    public LocalDate getMealDate() { return mealDate; }
    public void setMealDate(LocalDate mealDate) { this.mealDate = mealDate; }
    public String getMealType() { return mealType; }
    public void setMealType(String mealType) { this.mealType = mealType; }
    public Integer getTotalStudents() { return totalStudents; }
    public void setTotalStudents(Integer totalStudents) { this.totalStudents = totalStudents; }
    public Integer getAffectedStudentsCount() { return affectedStudentsCount; }
    public void setAffectedStudentsCount(Integer affectedStudentsCount) { this.affectedStudentsCount = affectedStudentsCount; }
    public Integer getConfirmedCount() { return confirmedCount; }
    public void setConfirmedCount(Integer confirmedCount) { this.confirmedCount = confirmedCount; }
    public Integer getPendingConfirmationCount() { return pendingConfirmationCount; }
    public void setPendingConfirmationCount(Integer pendingConfirmationCount) { this.pendingConfirmationCount = pendingConfirmationCount; }
    public Integer getRejectedCount() { return rejectedCount; }
    public void setRejectedCount(Integer rejectedCount) { this.rejectedCount = rejectedCount; }
    public Integer getReplacementCount() { return replacementCount; }
    public void setReplacementCount(Integer replacementCount) { this.replacementCount = replacementCount; }
    public Integer getAllergenConflictCount() { return allergenConflictCount; }
    public void setAllergenConflictCount(Integer allergenConflictCount) { this.allergenConflictCount = allergenConflictCount; }
    public String getReportContent() { return reportContent; }
    public void setReportContent(String reportContent) { this.reportContent = reportContent; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public String getGeneratedBy() { return generatedBy; }
    public void setGeneratedBy(String generatedBy) { this.generatedBy = generatedBy; }
    public LocalDateTime getGeneratedAt() { return generatedAt; }
    public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
    public String getReviewedBy() { return reviewedBy; }
    public void setReviewedBy(String reviewedBy) { this.reviewedBy = reviewedBy; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Boolean getFinalized() { return finalized; }
    public void setFinalized(Boolean finalized) { this.finalized = finalized; }
}
