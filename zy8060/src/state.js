export class AppState {
  constructor() {
    this.tray = null;
    this.instruments = [];
    this.rules = null;
    this.selectedInstrumentId = null;
    this.warnings = [];
    this.listeners = new Set();
  }
  
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  
  notify() {
    this.listeners.forEach(l => l(this));
  }
  
  setTray(tray) {
    this.tray = tray;
    this.notify();
  }
  
  setInstruments(instruments) {
    this.instruments = instruments;
    this.notify();
  }
  
  setRules(rules) {
    this.rules = rules;
    this.notify();
  }
  
  setSelectedInstrument(id) {
    this.selectedInstrumentId = id;
    this.notify();
  }
  
  setWarnings(warnings) {
    this.warnings = warnings;
    this.notify();
  }
  
  updateInstrumentPosition(id, position) {
    const inst = this.instruments.find(i => i.id === id);
    if (inst) {
      inst.position = { ...inst.position, ...position };
      this.notify();
    }
  }
  
  updateInstrumentRotation(id, rotation) {
    const inst = this.instruments.find(i => i.id === id);
    if (inst) {
      inst.rotation = { ...inst.rotation, ...rotation };
      this.notify();
    }
  }
}
