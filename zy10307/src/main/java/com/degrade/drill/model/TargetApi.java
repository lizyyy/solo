package com.degrade.drill.model;

import javax.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "target_api")
public class TargetApi {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String path;

    @Column(nullable = false)
    private String method;

    private String description;

    private Boolean enabled = true;
}