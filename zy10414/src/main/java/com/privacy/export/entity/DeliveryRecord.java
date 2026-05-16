package com.privacy.export.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "delivery_record")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "export_request_id", nullable = false, unique = true)
    private ExportRequest exportRequest;

    @Column(nullable = false, unique = true)
    private String deliveryId;

    private String deliveryMethod;

    private String deliveryChannel;

    private String recipientEmail;

    private String recipientPhone;

    @Column(nullable = false)
    private Integer attemptCount;

    @Column(nullable = false)
    private Boolean isCompleted;

    private Boolean isSuccess;

    private String notificationTemplateId;

    @Column(length = 5000)
    private String deliveryContent;

    @Column(length = 5000)
    private String deliveryLog;

    @Column(length = 5000)
    private String errorDetails;

    private String confirmationCode;

    private LocalDateTime confirmedAt;

    private String confirmedBy;

    private LocalDateTime expiryAt;

    private LocalDateTime startedAt;

    private LocalDateTime completedAt;

    private String executedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String createdBy;

    private LocalDateTime updatedAt;

    private String updatedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (attemptCount == null) {
            attemptCount = 0;
        }
        if (isCompleted == null) {
            isCompleted = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
