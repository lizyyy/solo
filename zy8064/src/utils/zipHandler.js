export async function handleZipFile(file) {
  const JSZip = await import('jszip')
  try {
    const zip = await JSZip.loadAsync(file)
    return { success: true, zip }
  } catch (err) {
    if (err.message.includes('encrypted') || err.message.includes('password')) {
      return { success: false, error: 'encrypted', message: '文件已加密' }
    }
    return { success: false, error: 'corrupt', message: '文件已损坏' }
  }
}
