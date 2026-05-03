export class StateManager {
  constructor() {
    this.state = {
      teethData: null,
      attachments: [],
      rules: null,
      currentStep: 1,
      maxStep: 1,
      selectedAttachment: null,
      issues: [],
      isDragging: false,
      cameraView: 'front'
    };
    
    this.listeners = [];
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;
  }

  getState() {
    return { ...this.state };
  }

  setState(updates, saveHistory = true) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    if (saveHistory && this.shouldSaveHistory(oldState, this.state)) {
      this.addToHistory(oldState);
    }
    
    this.notifyListeners();
  }

  shouldSaveHistory(oldState, newState) {
    const keys = ['attachments', 'currentStep', 'selectedAttachment'];
    return keys.some(key => oldState[key] !== newState[key]);
  }

  addToHistory(state) {
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    
    const historyEntry = JSON.stringify({
      attachments: state.attachments,
      currentStep: state.currentStep,
      selectedAttachment: state.selectedAttachment
    });
    
    this.history.push(historyEntry);
    
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }
  }

  canUndo() {
    return this.historyIndex > 0;
  }

  canRedo() {
    return this.historyIndex < this.history.length - 1;
  }

  undo() {
    if (!this.canUndo()) return false;
    
    this.historyIndex--;
    const entry = JSON.parse(this.history[this.historyIndex]);
    this.state = { ...this.state, ...entry };
    this.notifyListeners();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    
    this.historyIndex++;
    const entry = JSON.parse(this.history[this.historyIndex]);
    this.state = { ...this.state, ...entry };
    this.notifyListeners();
    return true;
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.state));
  }

  setTeethData(data) {
    this.setState({ teethData: data }, false);
  }

  setAttachments(attachments) {
    const maxStep = attachments.length > 0 
      ? Math.max(...attachments.map(a => a.step)) 
      : 1;
    this.setState({ 
      attachments, 
      maxStep,
      currentStep: Math.min(this.state.currentStep, maxStep)
    });
  }

  setRules(rules) {
    this.setState({ rules }, false);
  }

  setCurrentStep(step) {
    const clampedStep = Math.max(1, Math.min(step, this.state.maxStep));
    this.setState({ currentStep: clampedStep, selectedAttachment: null });
  }

  nextStep() {
    if (this.state.currentStep < this.state.maxStep) {
      this.setCurrentStep(this.state.currentStep + 1);
    }
  }

  previousStep() {
    if (this.state.currentStep > 1) {
      this.setCurrentStep(this.state.currentStep - 1);
    }
  }

  selectAttachment(attachmentId) {
    this.setState({ selectedAttachment: attachmentId }, false);
  }

  deselectAttachment() {
    this.setState({ selectedAttachment: null }, false);
  }

  updateAttachment(attachmentId, updates) {
    const attachments = this.state.attachments.map(att => {
      if (att.id === attachmentId) {
        return { ...att, ...updates };
      }
      return att;
    });
    this.setState({ attachments });
  }

  setIssues(issues) {
    const currentIssues = this.state.issues;
    if (JSON.stringify(currentIssues) === JSON.stringify(issues)) {
      return;
    }
    this.setState({ issues }, false);
  }

  setCameraView(view) {
    this.setState({ cameraView: view }, false);
  }

  getCurrentStepAttachments() {
    return this.state.attachments.filter(a => a.step === this.state.currentStep);
  }

  getAttachmentById(id) {
    return this.state.attachments.find(a => a.id === id);
  }

  getToothById(toothNumber) {
    if (!this.state.teethData) return null;
    const allTeeth = [...(this.state.teethData.upper || []), ...(this.state.teethData.lower || [])];
    return allTeeth.find(t => t.id === toothNumber);
  }

  exportState() {
    return {
      teethData: this.state.teethData,
      attachments: this.state.attachments,
      rules: this.state.rules,
      currentStep: this.state.currentStep,
      maxStep: this.state.maxStep,
      timestamp: new Date().toISOString()
    };
  }

  importState(stateData) {
    this.setState({
      teethData: stateData.teethData,
      attachments: stateData.attachments,
      rules: stateData.rules,
      currentStep: stateData.currentStep || 1,
      maxStep: stateData.maxStep || 1,
      selectedAttachment: null,
      issues: []
    });
    this.history = [];
    this.historyIndex = -1;
  }

  reset() {
    this.state = {
      teethData: null,
      attachments: [],
      rules: null,
      currentStep: 1,
      maxStep: 1,
      selectedAttachment: null,
      issues: [],
      isDragging: false,
      cameraView: 'front'
    };
    this.history = [];
    this.historyIndex = -1;
    this.notifyListeners();
  }
}
