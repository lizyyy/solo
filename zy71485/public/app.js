const { createApp, ref, reactive, onMounted } = Vue;

const app = createApp({
  setup() {
    const currentView = ref('list');
    const batches = ref([]);
    const currentBatch = ref(null);
    const currentTracks = ref([]);
    const currentLogs = ref([]);
    
    const createBatchDialog = ref(false);
    const editTrackDialog = ref(false);
    const logsDialog = ref(false);
    const importPreviewDialog = ref(false);
    
    const newBatchForm = reactive({ name: '', source: '' });
    const editTrackForm = reactive({});
    const isrcValidation = reactive({ issues: [] });
    const importPreviewData = ref([]);
    const pendingBatchId = ref(null);

    const fetchBatches = async () => {
      const res = await fetch('/api/batches');
      batches.value = await res.json();
    };

    const fetchBatchDetail = async (id) => {
      const res = await fetch(`/api/batches/${id}`);
      const data = await res.json();
      currentBatch.value = data;
      currentTracks.value = data.tracks;
    };

    const showCreateBatch = () => {
      newBatchForm.name = '';
      newBatchForm.source = '';
      createBatchDialog.value = true;
    };

    const createBatch = async () => {
      if (!newBatchForm.name) return;
      
      const res = await fetch('/api/batches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBatchForm)
      });
      
      createBatchDialog.value = false;
      await fetchBatches();
    };

    const openBatch = (batch) => {
      fetchBatchDetail(batch.id);
      currentView.value = 'detail';
    };

    const backToList = async () => {
      currentView.value = 'list';
      await fetchBatches();
    };

    const deleteBatch = async (batch) => {
      if (!confirm(`确定要删除批次"${batch.name}"吗？`)) return;
      
      await fetch(`/api/batches/${batch.id}`, { method: 'DELETE' });
      await fetchBatches();
    };

    const editTrack = (track) => {
      Object.assign(editTrackForm, { ...track });
      isrcValidation.issues = [];
      editTrackDialog.value = true;
    };

    const validateISRC = async () => {
      if (!editTrackForm.isrc) {
        isrcValidation.issues = [];
        return;
      }
      
      const res = await fetch('/api/validate/isrc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isrc: editTrackForm.isrc })
      });
      
      const result = await res.json();
      isrcValidation.issues = result.issues;
    };

    const saveTrack = async () => {
      const res = await fetch(`/api/tracks/${editTrackForm.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editTrackForm)
      });
      
      editTrackDialog.value = false;
      await fetchBatchDetail(currentBatch.value.id);
    };

    const viewLogs = async (track) => {
      const res = await fetch(`/api/tracks/${track.id}/logs`);
      currentLogs.value = await res.json();
      logsDialog.value = true;
    };

    const loadSamples = async () => {
      await fetch('/api/samples', { method: 'POST' });
      await fetchBatches();
      ElementPlus.ElMessage.success('样例数据已加载');
    };

    const parseFile = (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet);
          
          const mapped = json.map(row => ({
            isrc: row.ISRC || row.isrc || row['ISRC码'] || '',
            track_name: row.track_name || row['曲目名称'] || row.name || row['歌名'] || '',
            artist: row.artist || row['演唱者'] || row['歌手'] || '',
            lyricist: row.lyricist || row['词作者'] || row['作词'] || '',
            composer: row.composer || row['曲作者'] || row['作曲'] || '',
            platform_version: row.platform_version || row['平台版本'] || row['版本'] || '',
            duration: row.duration || row['时长'] || ''
          }));
          
          resolve(mapped);
        };
        reader.readAsArrayBuffer(file);
      });
    };

    const handleFileUpload = async (file) => {
      const data = await parseFile(file);
      importPreviewData.value = data;
      pendingBatchId.value = null;
      importPreviewDialog.value = true;
      return false;
    };

    const handleImportToBatch = async (file) => {
      const data = await parseFile(file);
      importPreviewData.value = data;
      pendingBatchId.value = currentBatch.value.id;
      importPreviewDialog.value = true;
      return false;
    };

    const confirmImport = async () => {
      let batchId = pendingBatchId.value;
      
      if (!batchId) {
        const batchName = `导入批次 ${new Date().toLocaleDateString()}`;
        const res = await fetch('/api/batches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: batchName, source: 'file_import' })
        });
        const batch = await res.json();
        batchId = batch.id;
      }
      
      await fetch(`/api/batches/${batchId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: importPreviewData.value })
      });
      
      importPreviewDialog.value = false;
      importPreviewData.value = [];
      
      if (pendingBatchId.value) {
        await fetchBatchDetail(pendingBatchId.value);
      } else {
        await fetchBatches();
      }
      
      ElementPlus.ElMessage.success('导入成功');
    };

    const exportBatch = () => {
      window.open(`/api/export/batch/${currentBatch.value.id}`, '_blank');
    };

    const parseIssues = (issues) => {
      if (!issues) return [];
      try {
        return JSON.parse(issues);
      } catch {
        return [];
      }
    };

    const hasErrorIssue = (track, type) => {
      const issues = parseIssues(track.issues);
      return issues.some(i => (i.type === type || i.type === type + '_duplicate') && i.severity === 'error');
    };

    const getIssueType = (severity) => {
      switch (severity) {
        case 'error': return 'danger';
        case 'warning': return 'warning';
        case 'info': return 'info';
        default: return 'info';
      }
    };

    const getStatusType = (status) => {
      switch (status) {
        case 'confirmed': return 'success';
        case 'rejected': return 'danger';
        case 'pending': return 'warning';
        default: return 'info';
      }
    };

    const getStatusText = (status) => {
      switch (status) {
        case 'confirmed': return '已确认';
        case 'rejected': return '已驳回';
        case 'pending': return '待处理';
        default: return status;
      }
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleString('zh-CN');
    };

    onMounted(() => {
      fetchBatches();
    });

    return {
      currentView,
      batches,
      currentBatch,
      currentTracks,
      currentLogs,
      createBatchDialog,
      editTrackDialog,
      logsDialog,
      importPreviewDialog,
      newBatchForm,
      editTrackForm,
      isrcValidation,
      importPreviewData,
      fetchBatches,
      showCreateBatch,
      createBatch,
      openBatch,
      backToList,
      deleteBatch,
      editTrack,
      validateISRC,
      saveTrack,
      viewLogs,
      loadSamples,
      handleFileUpload,
      handleImportToBatch,
      confirmImport,
      exportBatch,
      parseIssues,
      hasErrorIssue,
      getIssueType,
      getStatusType,
      getStatusText,
      formatDate
    };
  }
});

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component);
}

app.use(ElementPlus);
app.mount('#app');
