interface StateVector {
  altitude: number;
  velocity: number;
}

export interface DerivativeFunction {
  (state: StateVector, time: number): StateVector;
}

export class RK4Integrator {
  private stepSize: number;

  constructor(stepSize: number = 0.01) {
    this.stepSize = stepSize;
  }

  integrate(
    initialState: StateVector,
    duration: number,
    derivatives: DerivativeFunction
  ): StateVector[] {
    const states: StateVector[] = [{ ...initialState }];
    let currentState = { ...initialState };
    let currentTime = 0;

    while (currentTime < duration && currentState.altitude > 0) {
      const k1 = derivatives(currentState, currentTime);
      const k2 = derivatives(
        this.addStates(currentState, this.scaleState(k1, this.stepSize / 2)),
        currentTime + this.stepSize / 2
      );
      const k3 = derivatives(
        this.addStates(currentState, this.scaleState(k2, this.stepSize / 2)),
        currentTime + this.stepSize / 2
      );
      const k4 = derivatives(
        this.addStates(currentState, this.scaleState(k3, this.stepSize)),
        currentTime + this.stepSize
      );

      const delta = this.scaleState(
        this.addStates(
          this.addStates(k1, this.scaleState(k2, 2)),
          this.addStates(this.scaleState(k3, 2), k4)
        ),
        this.stepSize / 6
      );

      currentState = this.addStates(currentState, delta);
      currentTime += this.stepSize;

      if (currentState.altitude <= 0) {
        currentState.altitude = 0;
        states.push({ ...currentState });
        break;
      }

      states.push({ ...currentState });
    }

    return states;
  }

  private addStates(a: StateVector, b: StateVector): StateVector {
    return {
      altitude: a.altitude + b.altitude,
      velocity: a.velocity + b.velocity
    };
  }

  private scaleState(state: StateVector, scale: number): StateVector {
    return {
      altitude: state.altitude * scale,
      velocity: state.velocity * scale
    };
  }
}

export const createIntegrator = (stepSize?: number) => new RK4Integrator(stepSize);
