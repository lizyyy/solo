package com.school.canteen.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "parent_confirmations",
    uniqueConstraints = {
        @UniqueConstraint(columnNames = {"replacement_id", "student_id"})
    }
)
public class ParentConfirmation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "replacement_id", nullable = false)
    private ReplacementRequest replacement;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private Student student;

    @Column(nullable = false, length = 30)
    private String confirmationStatus;

    @Column(length = 1000)
    private String parentComment;

    @Column(length = 100)
    private String confirmedBy;

    private LocalDateTime confirmedAt;

    @Column(length = 100)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 100)
    private String updatedBy;

    private LocalDateTime updatedAt;

    @Version
    private Long version;
}
