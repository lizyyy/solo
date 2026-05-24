package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.DisposalType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "disposal_records")
public class DisposalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false, unique = true)
    private LostItem lostItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DisposalType disposalType;

    @Column(nullable = false, length = 50)
    private String appliedBy;

    @Column(nullable = false)
    private LocalDateTime appliedAt;

    @Column(length = 1000)
    private String applyReason;

    private boolean managerApproved;

    @Column(length = 50)
    private String approvedBy;

    private LocalDateTime approvedAt;

    @Column(length = 500)
    private String approveRemark;

    @Column(length = 500)
    private String evidenceImageUrls;

    @Column(nullable = false, length = 50)
    private String handledBy;

    @Column(nullable = false)
    private LocalDateTime disposedAt;

    @Column(length = 1000)
    private String disposalDetail;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String requestId;
}
