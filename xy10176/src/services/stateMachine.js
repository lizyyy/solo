const { SampleStatus, StepType, ErrorCode } = require('../constants/status');

const TRANSITIONS = {
  [SampleStatus.INIT]: {
    [StepType.COLLECT]: SampleStatus.COLLECTED
  },
  [SampleStatus.COLLECTED]: {
    [StepType.CENTRIFUGE]: SampleStatus.CENTRIFUGED
  },
  [SampleStatus.CENTRIFUGED]: {
    [StepType.TEST]: SampleStatus.TESTED
  },
  [SampleStatus.TESTED]: {
    [StepType.REVIEW]: SampleStatus.REVIEWED
  },
  [SampleStatus.EXCEPTION]: {}
};

const STEP_PREVIOUS_STATUS = {
  [StepType.COLLECT]: SampleStatus.INIT,
  [StepType.CENTRIFUGE]: SampleStatus.COLLECTED,
  [StepType.TEST]: SampleStatus.CENTRIFUGED,
  [StepType.REVIEW]: SampleStatus.TESTED
};

const STEP_REQUEST_ID_FIELD = {
  [StepType.COLLECT]: 'requestIdCollect',
  [StepType.CENTRIFUGE]: 'requestIdCentrifuge',
  [StepType.TEST]: 'requestIdTest',
  [StepType.REVIEW]: 'requestIdReview'
};

const STEP_TIME_FIELD = {
  [StepType.COLLECT]: 'collectTime',
  [StepType.CENTRIFUGE]: 'centrifugeTime',
  [StepType.TEST]: 'testTime',
  [StepType.REVIEW]: 'reviewTime'
};

const STEP_PREVIOUS_TIME_FIELD = {
  [StepType.CENTRIFUGE]: 'collectTime',
  [StepType.TEST]: 'centrifugeTime',
  [StepType.REVIEW]: 'testTime'
};

class StateMachineService {
  canTransition(fromStatus, stepType) {
    const transitions = TRANSITIONS[fromStatus];
    if (!transitions) return false;
    return !!transitions[stepType];
  }

  getNextStatus(fromStatus, stepType) {
    if (!this.canTransition(fromStatus, stepType)) {
      return null;
    }
    return TRANSITIONS[fromStatus][stepType];
  }

  getPreviousStatusForStep(stepType) {
    return STEP_PREVIOUS_STATUS[stepType];
  }

  getRequestIdField(stepType) {
    return STEP_REQUEST_ID_FIELD[stepType];
  }

  getTimeField(stepType) {
    return STEP_TIME_FIELD[stepType];
  }

  getPreviousTimeField(stepType) {
    return STEP_PREVIOUS_TIME_FIELD[stepType];
  }

  getStepDuration(sample, stepType) {
    const timeField = this.getTimeField(stepType);
    const prevTimeField = this.getPreviousTimeField(stepType);

    if (!prevTimeField) {
      return null;
    }

    const currentTime = sample[timeField];
    const prevTime = sample[prevTimeField];

    if (!currentTime || !prevTime) {
      return null;
    }

    return new Date(currentTime) - new Date(prevTime);
  }

  getValidTransitions() {
    return { ...TRANSITIONS };
  }
}

module.exports = new StateMachineService();
module.exports.TRANSITIONS = TRANSITIONS;
module.exports.STEP_PREVIOUS_STATUS = STEP_PREVIOUS_STATUS;
