package com.pottery.kilnqueue.repository;

import com.pottery.kilnqueue.entity.Work;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkRepository extends JpaRepository<Work, Long> {
    Optional<Work> findByWorkNo(String workNo);
    List<Work> findByStudentId(Long studentId);
    boolean existsByWorkNo(String workNo);
}
