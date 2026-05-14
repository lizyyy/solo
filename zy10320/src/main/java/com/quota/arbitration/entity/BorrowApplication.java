package com.quota.arbitration.entity;

import com.quota.arbitration.enums.ApplicationStatus;
import javax.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "borrow_application")
public class BorrowApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String applicationNo;

    @Column(nullable = false)
    private String customerId;

    @Column(nullable = false)
    private String customerName;

    @Column(nullable = false)
    private String poolCode;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal requestAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal approvedAmount;

    @Column(nullable = false)
    private Integer borrowDays;

    private LocalDateTime expectedReturnDate;

    @Column(length = 2000)
    private String borrowReason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApplicationStatus status;

    private String applicant;

    private String currentApprover;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ApplicationStatus.DRAFT;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
