package com.agri.dronespray.repository;

import com.agri.dronespray.entity.WeatherWindow;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface WeatherWindowRepository extends JpaRepository<WeatherWindow, Long> {

    List<WeatherWindow> findByArea(String area);

    @Query("SELECT w FROM WeatherWindow w WHERE w.startTime <= :time AND w.endTime >= :time")
    List<WeatherWindow> findActiveWindowsAtTime(@Param("time") LocalDateTime time);

    @Query("SELECT w FROM WeatherWindow w WHERE w.area = :area AND w.startTime <= :endTime AND w.endTime >= :startTime")
    List<WeatherWindow> findOverlappingWindows(@Param("area") String area,
                                                @Param("startTime") LocalDateTime startTime,
                                                @Param("endTime") LocalDateTime endTime);
}
