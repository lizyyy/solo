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

  getSnapshotByIndex: async (index: number) => {
    const response = await fetch(`/api/snapshots/${index}`);
    return response.json();
  },

  playbackControl: async (action: string, index?: number, speed?: number) => {
    const body: Record<string, any> = { action };
    if (index !== undefined) body.index = index;
    if (speed !== undefined) body.speed = speed;
    
    const response = await fetch('/api/playback/control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return response.json();
  },
};
