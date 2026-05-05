import _ from 'lodash';
import {
  TrackingEvent,
  FunnelAnalysis,
  FunnelStep,
  BreakpointInfo,
} from '../types';

export interface FunnelDefinition {
  name: string;
  steps: string[];
}

export const DEFAULT_FUNNELS: FunnelDefinition[] = [
  {
    name: 'Purchase Funnel',
    steps: ['page_view', 'product_view', 'add_to_cart', 'checkout_start', 'purchase_complete'],
  },
  {
    name: 'Checkout Funnel',
    steps: ['add_to_cart', 'checkout_start', 'purchase_complete'],
  },
];

export function analyzeFunnel(
  events: TrackingEvent[],
  funnelDefinition: FunnelDefinition,
  sessionBased: boolean = true
): FunnelAnalysis {
  const { steps } = funnelDefinition;
  
  if (sessionBased) {
    return analyzeSessionBasedFunnel(events, funnelDefinition);
  }
  
  // Simple count-based analysis
  const eventCounts: Record<string, number> = {};
  steps.forEach(step => {
    eventCounts[step] = events.filter(e => e.event_name === step).length;
  });
  
  const funnelSteps: FunnelStep[] = steps.map((step, index) => {
    const count = eventCounts[step] || 0;
    const conversionRate = index > 0 && eventCounts[steps[index - 1]] > 0
      ? (count / eventCounts[steps[index - 1]]) * 100
      : (index === 0 ? 100 : 0);
    const dropOffRate = index > 0
      ? 100 - conversionRate
      : 0;
    
    return {
      event_name: step,
      count,
      conversion_rate: conversionRate,
      drop_off_rate: dropOffRate,
    };
  });
  
  const breakpoints: BreakpointInfo[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const currentStep = steps[i];
    const nextStep = steps[i + 1];
    const currentCount = eventCounts[currentStep] || 0;
    const nextCount = eventCounts[nextStep] || 0;
    const dropOffCount = currentCount - nextCount;
    const dropOffRate = currentCount > 0 ? (dropOffCount / currentCount) * 100 : 0;
    
    if (dropOffRate > 50 || dropOffCount > 10) {
      breakpoints.push({
        step_index: i,
        step_name: currentStep,
        next_step_name: nextStep,
        drop_off_count: dropOffCount,
        drop_off_rate: dropOffRate,
        affected_events: [],
      });
    }
  }
  
  const totalConversionRate = funnelSteps.length > 0
    ? ((funnelSteps[funnelSteps.length - 1].count || 0) / (funnelSteps[0].count || 1)) * 100
    : 0;
  
  return {
    funnel_name: funnelDefinition.name,
    steps: funnelSteps,
    breakpoints,
    total_conversion_rate: totalConversionRate,
  };
}

function analyzeSessionBasedFunnel(
  events: TrackingEvent[],
  funnelDefinition: FunnelDefinition
): FunnelAnalysis {
  const { steps } = funnelDefinition;
  
  // Group events by session
  const sessions = _.groupBy(events, 'session_id');
  
  // Track how many sessions completed each step
  const sessionStepCounts: number[] = new Array(steps.length).fill(0);
  const successfulPaths: string[][] = [];
  
  for (const [sessionId, sessionEvents] of Object.entries(sessions)) {
    // Sort events by timestamp
    const sortedEvents = _.sortBy(sessionEvents, 'timestamp');
    
    // Track progress through funnel
    let currentStepIndex = 0;
    const path: string[] = [];
    
    for (const event of sortedEvents) {
      if (currentStepIndex < steps.length && event.event_name === steps[currentStepIndex]) {
        path.push(event.event_name);
        sessionStepCounts[currentStepIndex]++;
        currentStepIndex++;
      }
    }
    
    if (path.length > 0) {
      successfulPaths.push(path);
    }
  }
  
  const funnelSteps: FunnelStep[] = steps.map((step, index) => {
    const count = sessionStepCounts[index];
    const conversionRate = index > 0 && sessionStepCounts[index - 1] > 0
      ? (count / sessionStepCounts[index - 1]) * 100
      : (index === 0 ? 100 : 0);
    const dropOffRate = index > 0
      ? 100 - conversionRate
      : 0;
    
    return {
      event_name: step,
      count,
      conversion_rate: conversionRate,
      drop_off_rate: dropOffRate,
    };
  });
  
  const breakpoints: BreakpointInfo[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    const currentStep = steps[i];
    const nextStep = steps[i + 1];
    const currentCount = sessionStepCounts[i] || 0;
    const nextCount = sessionStepCounts[i + 1] || 0;
    const dropOffCount = currentCount - nextCount;
    const dropOffRate = currentCount > 0 ? (dropOffCount / currentCount) * 100 : 0;
    
    if (dropOffRate > 40 || dropOffCount > 5) {
      breakpoints.push({
        step_index: i,
        step_name: currentStep,
        next_step_name: nextStep,
        drop_off_count: dropOffCount,
        drop_off_rate: dropOffRate,
        affected_events: [],
      });
    }
  }
  
  const totalConversionRate = funnelSteps.length > 0
    ? ((funnelSteps[funnelSteps.length - 1].count || 0) / (funnelSteps[0].count || 1)) * 100
    : 0;
  
  return {
    funnel_name: funnelDefinition.name,
    steps: funnelSteps,
    breakpoints,
    total_conversion_rate: totalConversionRate,
  };
}

export function analyzeAllFunnels(
  events: TrackingEvent[],
  customFunnels?: FunnelDefinition[]
): FunnelAnalysis[] {
  const funnels = customFunnels || DEFAULT_FUNNELS;
  return funnels.map(funnel => analyzeFunnel(events, funnel, true));
}

export function getStepDropOffDetails(
  events: TrackingEvent[],
  fromStep: string,
  toStep: string
): { droppedSessions: string[]; continuedSessions: string[] } {
  const sessions = _.groupBy(events, 'session_id');
  const droppedSessions: string[] = [];
  const continuedSessions: string[] = [];
  
  for (const [sessionId, sessionEvents] of Object.entries(sessions)) {
    const sortedEvents = _.sortBy(sessionEvents, 'timestamp');
    const eventNames = sortedEvents.map(e => e.event_name);
    
    const fromIndex = eventNames.indexOf(fromStep);
    const toIndex = eventNames.indexOf(toStep);
    
    if (fromIndex !== -1) {
      if (toIndex === -1 || toIndex <= fromIndex) {
        droppedSessions.push(sessionId);
      } else {
        continuedSessions.push(sessionId);
      }
    }
  }
  
  return { droppedSessions, continuedSessions };
}
