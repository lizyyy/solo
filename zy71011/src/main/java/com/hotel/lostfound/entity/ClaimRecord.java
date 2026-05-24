package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.IdType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "claim_records")
public class ClaimRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false)
    private LostItem lostItem;

    @Column(nullable = false, length = 100)
    private String claimantName;

    @Column(nullable = false, length = 50)
    private String claimantPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private IdType idType;

    @Column(nullable = false, length = 50)
    private String idNumber;

    @Column(length = 200)
    private String idImageUrl;

    @Column(length = 500)
    private String relation;

    @Column(length = 1000)
    private String itemDescription;

    private boolean identificationVerified;

    private boolean itemDescriptionMatched;

    private boolean approved;

    @Column(length = 50)
    private String approvedBy;

    private LocalDateTime approvedAt;

    @Column(length = 500)
    private String approveRemark;

    @Column(nullable = false, length = 50)
    private String handledBy;

    @Column(nullable = false)
    private LocalDateTime claimTime;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String requestId;
}
