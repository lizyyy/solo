package com.school.canteen.entity;

import jakarta.persistence.*;
import lombok.Data;

import java.util.HashSet;
import java.util.Set;

@Data
@Entity
@Table(name = "students")
public class Student {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String studentNo;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 50)
    private String grade;

    @Column(length = 50)
    private String className;

    @Column(length = 100)
    private String parentName;

    @Column(length = 50)
    private String parentPhone;

    @Column(length = 100)
    private String parentEmail;

    @ManyToMany
    @JoinTable(
        name = "student_allergens",
        joinColumns = @JoinColumn(name = "student_id"),
        inverseJoinColumns = @JoinColumn(name = "allergen_id")
    )
    private Set<Allergen> allergens = new HashSet<>();

    @Column(nullable = false)
    private Boolean active = true;
}
