package com.object.lifecycle.entity;

import com.object.lifecycle.common.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "object_prefix")
@Getter
@Setter
public class ObjectPrefix extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String prefix;

    @Column(nullable = false)
    private String bucketName;

    private String description;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Version
    private Long version;
}
