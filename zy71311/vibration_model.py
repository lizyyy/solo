import numpy as np
from scipy.integrate import odeint
from dataclasses import dataclass
from typing import Optional, Tuple


@dataclass
class VibrationParams:
    k: float
    zeta: float
    m: float
    omega_n: float
    omega_d: float
    c: float


class SDOFSystem:
    def __init__(self, m: float, k: float, zeta: float):
        self.m = m
        self.k = k
        self.zeta = zeta
        self.omega_n = np.sqrt(k / m)
        self.c = 2 * zeta * np.sqrt(k * m)
        
        if zeta < 1.0:
            self.omega_d = self.omega_n * np.sqrt(1 - zeta**2)
        else:
            self.omega_d = 0.0
    
    def get_params(self) -> VibrationParams:
        return VibrationParams(
            k=self.k,
            zeta=self.zeta,
            m=self.m,
            omega_n=self.omega_n,
            omega_d=self.omega_d,
            c=self.c
        )
    
    def free_vibration_analytical(
        self, 
        t: np.ndarray, 
        x0: float, 
        v0: float = 0.0
    ) -> np.ndarray:
        zeta = self.zeta
        omega_n = self.omega_n
        
        if zeta < 1.0:
            omega_d = self.omega_d
            A = x0
            B = (v0 + zeta * omega_n * x0) / omega_d
            x = np.exp(-zeta * omega_n * t) * (A * np.cos(omega_d * t) + B * np.sin(omega_d * t))
        
        elif abs(zeta - 1.0) < 1e-10:
            x = (x0 + (v0 + omega_n * x0) * t) * np.exp(-omega_n * t)
        
        else:
            s1 = -omega_n * (zeta + np.sqrt(zeta**2 - 1))
            s2 = -omega_n * (zeta - np.sqrt(zeta**2 - 1))
            C2 = (v0 - s1 * x0) / (s2 - s1)
            C1 = x0 - C2
            x = C1 * np.exp(s1 * t) + C2 * np.exp(s2 * t)
        
        return x
    
    @staticmethod
    def _ode(state: np.ndarray, t: np.ndarray, m: float, c: float, k: float) -> np.ndarray:
        x, v = state
        dxdt = v
        dvdt = -(c * v + k * x) / m
        return [dxdt, dvdt]
    
    def free_vibration_numerical(
        self, 
        t: np.ndarray, 
        x0: float, 
        v0: float = 0.0
    ) -> np.ndarray:
        state0 = [x0, v0]
        solution = odeint(self._ode, state0, t, args=(self.m, self.c, self.k))
        return solution[:, 0]
    
    def classify_damping(self) -> str:
        if self.zeta < 1e-6:
            return "无阻尼"
        elif self.zeta < 1.0:
            return "欠阻尼"
        elif abs(self.zeta - 1.0) < 1e-6:
            return "临界阻尼"
        else:
            return "过阻尼"


def generate_test_data(
    m: float,
    k: float,
    zeta: float,
    fs: float,
    duration: float,
    x0: float,
    noise_level: float = 0.0,
    v0: float = 0.0,
    add_anomaly: bool = False
) -> Tuple[np.ndarray, np.ndarray, dict]:
    system = SDOFSystem(m, k, zeta)
    t = np.arange(0, duration, 1/fs)
    x_clean = system.free_vibration_analytical(t, x0, v0)
    
    noise = np.random.normal(0, noise_level * np.max(np.abs(x_clean)), size=len(t))
    x_noisy = x_clean + noise
    
    meta = {
        "true_k": k,
        "true_zeta": zeta,
        "true_omega_n": system.omega_n,
        "true_omega_d": system.omega_d,
        "damping_type": system.classify_damping(),
        "snr": 20 * np.log10(np.std(x_clean) / np.std(noise)) if noise_level > 0 else np.inf
    }
    
    return t, x_noisy, meta
