import numpy as np
from .models import motion_model, compute_weights, effective_sample_size


class ParticleFilter:
    def __init__(self, num_particles, world_map, motion_noise, sensor_noise,
                 resample_threshold_ratio=0.5, initial_pos=None):
        self.num_particles = num_particles
        self.world_map = world_map
        self.motion_noise = motion_noise
        self.sensor_noise = sensor_noise
        self.resample_threshold_ratio = resample_threshold_ratio
        self.resample_threshold = num_particles * resample_threshold_ratio
        self.particles = np.zeros((num_particles, 3))
        self.weights = np.ones(num_particles) / num_particles
        self.alerts = []
        self.resample_events = []
        self.step = 0

        if initial_pos is not None:
            self.particles[:, 0] = initial_pos[0] + np.random.normal(0, 1.0, num_particles)
            self.particles[:, 1] = initial_pos[1] + np.random.normal(0, 1.0, num_particles)
            self.particles[:, 2] = initial_pos[2] + np.random.normal(0, 0.1, num_particles)
        else:
            self.particles[:, 0] = np.random.uniform(0, world_map.width, num_particles)
            self.particles[:, 1] = np.random.uniform(0, world_map.height, num_particles)
            self.particles[:, 2] = np.random.uniform(-np.pi, np.pi, num_particles)

        self._check_initial_obstacles()

    def _check_initial_obstacles(self):
        for i in range(self.num_particles):
            obs = self.world_map.in_obstacle(self.particles[i, 0], self.particles[i, 1])
            if obs:
                for _ in range(100):
                    x = np.random.uniform(0, self.world_map.width)
                    y = np.random.uniform(0, self.world_map.height)
                    if not self.world_map.in_obstacle(x, y):
                        self.particles[i, 0] = x
                        self.particles[i, 1] = y
                        break

    def predict(self, dx, dy, dtheta):
        old_positions = self.particles[:, :2].copy()
        self.particles = motion_model(self.particles, dx, dy, dtheta, self.motion_noise)
        self._check_obstacle_crossing(old_positions, self.particles[:, :2])
        self._check_bounds()
        self.step += 1

    def _check_obstacle_crossing(self, old_pos, new_pos):
        crossing_counts = {}
        crossing_examples = {}
        for i in range(len(self.particles)):
            obs = self.world_map.crosses_obstacle(
                old_pos[i, 0], old_pos[i, 1],
                new_pos[i, 0], new_pos[i, 1]
            )
            if obs:
                crossing_counts[obs.id] = crossing_counts.get(obs.id, 0) + 1
                if obs.id not in crossing_examples:
                    crossing_examples[obs.id] = i

        if crossing_counts:
            details = []
            for obs_id, count in crossing_counts.items():
                details.append(f"障碍'{obs_id}'被{count}个粒子穿越")
            detail_str = "，".join(details)
            ratio = sum(crossing_counts.values()) / self.num_particles
            severity = "高" if ratio > 0.3 else "中" if ratio > 0.1 else "低"
            self.alerts.append({
                "type": "obstacle_crossing",
                "step": self.step,
                "crossing_counts": crossing_counts,
                "total_crossing_particles": sum(crossing_counts.values()),
                "ratio": round(ratio, 4),
                "severity": severity,
                "reason": (
                    f"第{self.step}步共{sum(crossing_counts.values())}个粒子"
                    f"（占比{ratio:.1%}，严重度{severity}）穿越障碍：{detail_str}；"
                    f"运动噪声过大导致粒子轨迹不尊重地图约束，定位结果可能不可靠"
                )
            })

    def _check_bounds(self):
        for i in range(len(self.particles)):
            x, y = self.particles[i, 0], self.particles[i, 1]
            if not self.world_map.in_bounds(x, y):
                self.particles[i, 0] = np.clip(x, 0, self.world_map.width)
                self.particles[i, 1] = np.clip(y, 0, self.world_map.height)

    def update(self, observations):
        self.weights = compute_weights(
            self.particles, observations,
            self.world_map.landmarks, self.sensor_noise
        )
        ess = effective_sample_size(self.weights)

        if ess < self.resample_threshold:
            reason = (
                f"第{self.step}步有效样本数ESS={ess:.1f}，"
                f"低于阈值{self.resample_threshold:.1f}（粒子数{self.num_particles}×"
                f"{self.resample_threshold_ratio:.0%}），"
                f"粒子严重退化，执行重采样以恢复多样性"
            )
            self.resample_events.append({
                "step": self.step,
                "ess_before": round(ess, 2),
                "threshold": round(self.resample_threshold, 2),
                "reason": reason
            })
            self.alerts.append({
                "type": "degeneration",
                "step": self.step,
                "ess": round(ess, 2),
                "threshold": round(self.resample_threshold, 2),
                "reason": reason
            })
            self._resample()

    def _resample(self):
        indices = np.random.choice(
            self.num_particles, size=self.num_particles, p=self.weights
        )
        self.particles = self.particles[indices].copy()
        self.particles[:, 0] += np.random.normal(0, 0.01, self.num_particles)
        self.particles[:, 1] += np.random.normal(0, 0.01, self.num_particles)
        self.particles[:, 2] += np.random.normal(0, 0.005, self.num_particles)
        self.weights = np.ones(self.num_particles) / self.num_particles

    def estimate(self):
        x = np.average(self.particles[:, 0], weights=self.weights)
        y = np.average(self.particles[:, 1], weights=self.weights)
        sin_sum = np.average(np.sin(self.particles[:, 2]), weights=self.weights)
        cos_sum = np.average(np.cos(self.particles[:, 2]), weights=self.weights)
        theta = np.arctan2(sin_sum, cos_sum)
        return np.array([x, y, theta])

    def get_alerts(self):
        return self.alerts

    def get_resample_events(self):
        return self.resample_events
