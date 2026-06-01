import html2canvas from 'html2canvas';

export const exportScreenshot = async (
  elementId: string,
  filename: string = 'windblade-annotation'
): Promise<void> => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for export');
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0f172a',
      scale: 2,
      useCORS: true,
      logging: false
    });

    const link = document.createElement('a');
    link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (e) {
    console.error('Failed to export screenshot:', e);
    throw e;
  }
};

export const exportSchemeAsJSON = (
  scheme: { name: string; description: string; records: unknown[] },
  filename: string = 'windblade-scheme'
): void => {
  const dataStr = JSON.stringify(scheme, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const link = document.createElement('a');
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.json`;
  link.href = URL.createObjectURL(blob);
  link.click();
  URL.revokeObjectURL(link.href);
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
    return false;
  }
};
