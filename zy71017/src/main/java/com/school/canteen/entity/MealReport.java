package com.school.canteen.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
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
}
