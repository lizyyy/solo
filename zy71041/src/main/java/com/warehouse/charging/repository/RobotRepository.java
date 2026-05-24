package com.warehouse.charging.repository;

import com.warehouse.charging.model.Robot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface RobotRepository extends JpaRepository<Robot, Long> {
    Optional<Robot> findByRobotCode(String robotCode);
    boolean existsByRobotCode(String robotCode);
}
