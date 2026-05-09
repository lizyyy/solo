export const apiService = {
  startScenario: async (type: string, params: Record<string, any> = {}, duration: number = 30) => {
    const response = await fetch(`/api/scenario/${type}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        duration,
        parameters: params,
      }),
    });
    return response.json();
  },

  startRecovery: async (type: string) => {
    const response = await fetch(`/api/recovery/${type}`, {
      method: 'POST',
    });
    return response.json();
  },

  reset: async () => {
    const response = await fetch('/api/reset', {
      method: 'POST',
    });
    return response.json();
  },

  getState: async () => {
    const response = await fetch('/api/state');
    return response.json();
  },

  getEvents: async () => {
    const response = await fetch('/api/events');
    return response.json();
  },

  getSnapshots: async () => {
    const response = await fetch('/api/snapshots');
    return response.json();
  },
};
