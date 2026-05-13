package com.api.inspection.entity;

import com.api.inspection.enums.AssertionType;
import lombok.Data;

import javax.persistence.*;

@Data
@Entity
@Table(name = "assertion_rule")
public class AssertionRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "step_id", nullable = false)
    private TransactionStep step;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AssertionType assertionType;

    @Column(nullable = false)
    private String expectedValue;

    @Column
    private String expression;

    @Column(nullable = false)
    private Boolean enabled = true;
}
