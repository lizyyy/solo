package com.school.canteen.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Data
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
}
