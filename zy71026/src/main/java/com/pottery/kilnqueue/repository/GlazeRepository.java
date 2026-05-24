package com.pottery.kilnqueue.repository;

import com.pottery.kilnqueue.entity.Glaze;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface GlazeRepository extends JpaRepository<Glaze, Long> {
    Optional<Glaze> findByCode(String code);
    List<Glaze> findByCodeIn(Set<String> codes);
    List<Glaze> findByActiveTrue();
    boolean existsByCode(String code);
}
