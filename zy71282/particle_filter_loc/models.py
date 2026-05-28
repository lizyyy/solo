import math
import numpy as np


def motion_model(particles, dx, dy, dtheta, noise):
    n = len(particles)
    noise_dx = noise.get("dx", 0.0)
    noise_dy = noise.get("dy", 0.0)
    noise_dtheta = noise.get("dtheta", 0.0)

    particles[:, 0] += dx + np.random.normal(0, noise_dx, n)
    particles[:, 1] += dy + np.random.normal(0, noise_dy, n)
    particles[:, 2] += dtheta + np.random.normal(0, noise_dtheta, n)
    particles[:, 2] = (particles[:, 2] + math.pi) % (2 * math.pi) - math.pi
    return particles


def sensor_likelihood(particle, observations, landmarks, noise):
    log_weight = 0.0
    range_noise = noise.get("range", 0.5)
    bearing_noise = noise.get("bearing", 0.05)

    for obs in observations:
        lm = None
        for l in landmarks:
            if l.id == obs["landmark_id"]:
                lm = l
                break
        if lm is None:
            continue

        dx = lm.x - particle[0]
        dy = lm.y - particle[1]
        expected_range = math.sqrt(dx ** 2 + dy ** 2)
        expected_bearing = (math.atan2(dy, dx) - particle[2] + math.pi) % (2 * math.pi) - math.pi

        range_diff = obs["range"] - expected_range
        bearing_diff = obs["bearing"] - expected_bearing
        bearing_diff = (bearing_diff + math.pi) % (2 * math.pi) - math.pi

        if range_noise > 0:
            log_weight -= 0.5 * (range_diff / range_noise) ** 2
        if bearing_noise > 0:
            log_weight -= 0.5 * (bearing_diff / bearing_noise) ** 2

    return log_weight


def compute_weights(particles, observations_list, landmarks, noise):
    n = len(particles)
    log_weights = np.zeros(n)

    for i in range(n):
        log_weights[i] = sensor_likelihood(particles[i], observations_list, landmarks, noise)

    max_log = np.max(log_weights)
    if max_log == -np.inf:
        return np.ones(n) / n

    weights = np.exp(log_weights - max_log)
    total = np.sum(weights)
    if total == 0:
        return np.ones(n) / n
    weights /= total
    return weights


def effective_sample_size(weights):
    return 1.0 / np.sum(weights ** 2)
