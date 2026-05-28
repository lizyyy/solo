import math


class Obstacle:
    def __init__(self, obs_id, obs_type, **kwargs):
        self.id = obs_id
        self.type = obs_type
        self.params = kwargs

    def contains(self, x, y):
        if self.type == "rectangle":
            ox = self.params["x"]
            oy = self.params["y"]
            ow = self.params["width"]
            oh = self.params["height"]
            return ox <= x <= ox + ow and oy <= y <= oy + oh
        elif self.type == "circle":
            cx = self.params["x"]
            cy = self.params["y"]
            r = self.params["radius"]
            return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2
        return False

    def intersects_segment(self, x1, y1, x2, y2, samples=20):
        for i in range(samples + 1):
            t = i / samples
            px = x1 + t * (x2 - x1)
            py = y1 + t * (y2 - y1)
            if self.contains(px, py):
                return True
        return False


class Landmark:
    def __init__(self, lm_id, x, y):
        self.id = lm_id
        self.x = x
        self.y = y


class Map:
    def __init__(self, map_id, version, width, height, obstacles=None, landmarks=None):
        self.id = map_id
        self.version = version
        self.width = width
        self.height = height
        self.obstacles = obstacles or []
        self.landmarks = landmarks or []

    def in_bounds(self, x, y):
        return 0 <= x <= self.width and 0 <= y <= self.height

    def in_obstacle(self, x, y):
        for obs in self.obstacles:
            if obs.contains(x, y):
                return obs
        return None

    def crosses_obstacle(self, x1, y1, x2, y2):
        for obs in self.obstacles:
            if obs.intersects_segment(x1, y1, x2, y2):
                return obs
        return None

    def landmark_by_id(self, lm_id):
        for lm in self.landmarks:
            if lm.id == lm_id:
                return lm
        return None

    @classmethod
    def from_dict(cls, d):
        obstacles = []
        for o in d.get("obstacles", []):
            obs_type = o.get("type", "rectangle")
            params = {k: v for k, v in o.items() if k not in ("id", "type")}
            obstacles.append(Obstacle(o.get("id", ""), obs_type, **params))

        landmarks = []
        for lm in d.get("landmarks", []):
            landmarks.append(Landmark(lm.get("id", ""), lm["x"], lm["y"]))

        return cls(
            map_id=d.get("id", ""),
            version=d.get("version", 1),
            width=d.get("width", 100),
            height=d.get("height", 100),
            obstacles=obstacles,
            landmarks=landmarks,
        )
