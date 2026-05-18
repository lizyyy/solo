package com.riskcontrol.graylist.entity;

import com.riskcontrol.graylist.enums.GraylistStatus;
import com.riskcontrol.graylist.enums.ReviewConclusion;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "review_history", indexes = {
    @Index(name = "idx_record_id", columnList = "recordId"),
    @Index(name = "idx_reviewer", columnList = "reviewer")
})
public class ReviewHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long recordId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private GraylistStatus previousStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private GraylistStatus newStatus;

    @Enumerated(EnumType.STRING)
    @Column(length = 32)
    private ReviewConclusion conclusion;

    @Column(length = 1024)
    private String reviewRemark;

    @Column(nullable = false, length = 64)
    private String reviewer;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime reviewTime;
}
