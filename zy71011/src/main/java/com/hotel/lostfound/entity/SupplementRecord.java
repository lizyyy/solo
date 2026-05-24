package com.hotel.lostfound.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "supplement_records")
public class SupplementRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false)
    private LostItem lostItem;

    @Column(nullable = false, length = 100)
    private String supplementType;

    @Column(length = 1000)
    private String supplementContent;

    @Column(length = 500)
    private String evidenceImageUrls;

    @Column(nullable = false, length = 50)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime operateTime;

    @Column(length = 500)
    private String remark;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String requestId;
}
