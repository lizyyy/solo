package com.ski.rental.repository;

import com.ski.rental.model.Snowboard;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SnowboardRepository extends JpaRepository<Snowboard, Long> {
    Optional<Snowboard> findByBoardCode(String boardCode);
    Optional<Snowboard> findByBoardCodeAndIsAvailableTrue(String boardCode);
}
