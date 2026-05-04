const { getSimulatorConfig, SIMULATOR_MODES } = require('../dao/simulatorDao');
const { getAttemptsByEventId } = require('../dao/attemptDao');

function extractEventTypeFromBody(rawBody) {
  try {
    const parsed = JSON.parse(rawBody);
    return parsed.eventType || parsed.type || '*';
  } catch (e) {
    return '*';
  }
}

async function simulateDownstreamProcessing(event, provider) {
  const eventType = extractEventTypeFromBody(event.raw_body);
  const config = await getSimulatorConfig(provider.id, eventType);
  
  if (!config) {
    return { success: true, message: 'No simulator config, default success' };
  }
  
  if (config.delay_ms && config.delay_ms > 0) {
    await new Promise(resolve => setTimeout(resolve, config.delay_ms));
  }
  
  const previousAttempts = await getAttemptsByEventId(event.id);
  const failAttemptsCount = previousAttempts.filter(a => a.status === 'failed' && !a.is_replay).length;
  
  const actualAttemptNumber = failAttemptsCount + 1;
  
  switch (config.mode) {
    case SIMULATOR_MODES.SUCCESS:
      return { success: true, message: 'Simulator: success mode' };
      
    case SIMULATOR_MODES.FAIL_ALWAYS:
      return {
        success: false,
        error: config.error_message || 'Simulator: always fail mode',
      };
      
    case SIMULATOR_MODES.FAIL_N_TIMES:
      if (actualAttemptNumber <= (config.fail_count || 1)) {
        return {
          success: false,
          error: config.error_message || `Simulator: fail attempt ${actualAttemptNumber}/${config.fail_count}`,
          attemptNumber: actualAttemptNumber,
          failCount: config.fail_count,
        };
      } else {
        return { success: true, message: `Simulator: success after ${config.fail_count} failures` };
      }
      
    default:
      return { success: true, message: 'Simulator: unknown mode, default success' };
  }
}

module.exports = {
  simulateDownstreamProcessing,
  extractEventTypeFromBody,
};
