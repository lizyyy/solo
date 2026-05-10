<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useInspectorStore } from '../stores/inspectorStore';
import { DefectType } from '../types';
import type { Photo, Defect } from '../types';
import { X, Camera, Trash2 } from 'lucide-vue-next';

const store = useInspectorStore();

const props = defineProps<{
  position?: { floor: number; column: number };
  defect?: Defect | null;
  show: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>();

const isEdit = computed(() => !!props.defect);
const formTitle = computed(() => isEdit.value ? '编辑缺陷' : '新增缺陷');

const buildingId = ref(props.defect?.buildingId || store.selectedBuildingId || '');
const floor = ref(props.position?.floor || props.defect?.floor || 1);
const column = ref(props.position?.column || props.defect?.column || 1);
const type = ref<DefectType>(props.defect?.type || DefectType.CRACK);
const description = ref(props.defect?.description || '');
const inspectionNote = ref(props.defect?.inspectionNote || '');
const photos = ref<Photo[]>(props.defect?.photos || []);
const errors = ref<Record<string, string>>({});

watch(() => props.show, (newVal) => {
  if (newVal) {
    buildingId.value = props.defect?.buildingId || store.selectedBuildingId || '';
    floor.value = props.position?.floor || props.defect?.floor || 1;
    column.value = props.position?.column || props.defect?.column || 1;
    type.value = props.defect?.type || DefectType.CRACK;
    description.value = props.defect?.description || '';
    inspectionNote.value = props.defect?.inspectionNote || '';
    photos.value = props.defect?.photos || [];
    errors.value = {};
  }
});

const availableBuildings = computed(() => store.buildings);

const currentBuilding = computed(() => 
  store.buildings.find(b => b.id === buildingId.value)
);

const validateForm = () => {
  errors.value = {};
  
  if (!buildingId.value) {
    errors.value.buildingId = '请选择建筑';
  }
  
  if (!currentBuilding.value) {
    errors.value.buildingId = '建筑不存在';
  } else {
    if (floor.value < 1 || floor.value > currentBuilding.value.floors) {
      errors.value.floor = `楼层必须在 1-${currentBuilding.value.floors} 之间`;
    }
    if (column.value < 1 || column.value > currentBuilding.value.columns) {
      errors.value.column = `列必须在 1-${currentBuilding.value.columns} 之间`;
    }
  }
  
  if (!description.value.trim()) {
    errors.value.description = '请填写缺陷描述';
  }
  
  return Object.keys(errors.value).length === 0;
};

const handleFileUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const files = input.files;
  
  if (!files || files.length === 0) return;
  
  Array.from(files).forEach(file => {
    const photo: Photo = {
      id: store.generateId('photo'),
      url: URL.createObjectURL(file),
      name: file.name,
      uploadedAt: Date.now()
    };
    photos.value.push(photo);
    console.log(`[上传] 照片: ${file.name}`);
  });
  
  input.value = '';
};

const removePhoto = (photoId: string) => {
  const index = photos.value.findIndex(p => p.id === photoId);
  if (index > -1) {
    const photo = photos.value[index];
    photos.value.splice(index, 1);
    console.log(`[移除] 照片: ${photo.name}`);
  }
};

const handleSubmit = () => {
  if (!validateForm()) {
    console.error('[表单] 验证失败:', errors.value);
    return;
  }
  
  if (isEdit.value && props.defect) {
    const success = store.updateDefect(props.defect.id, {
      buildingId: buildingId.value,
      floor: floor.value,
      column: column.value,
      type: type.value,
      description: description.value,
      inspectionNote: inspectionNote.value,
      photos: photos.value
    });
    if (success) {
      console.log('[更新] 缺陷成功:', props.defect.id);
      emit('success');
      emit('close');
    }
  } else {
    const newDefect = store.createDefect({
      buildingId: buildingId.value,
      floor: floor.value,
      column: column.value,
      type: type.value,
      description: description.value,
      inspectionNote: inspectionNote.value,
      photos: photos.value
    });
    
    if (newDefect) {
      console.log('[创建] 缺陷成功:', newDefect.id);
      store.selectDefect(newDefect);
      emit('success');
      emit('close');
    } else {
      console.error('[创建] 缺陷失败');
    }
  }
};
</script>

<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ formTitle }}</h3>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>建筑 <span class="required">*</span></label>
          <select 
            v-model="buildingId" 
            :class="{ 'has-error': errors.buildingId }"
            disabled
          >
            <option value="" disabled>请选择建筑</option>
            <option v-for="b in availableBuildings" :key="b.id" :value="b.id">
              {{ b.name }} ({{ b.floors }}F × {{ b.columns }}列)
            </option>
          </select>
          <span v-if="errors.buildingId" class="error-text">{{ errors.buildingId }}</span>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>楼层 <span class="required">*</span></label>
            <input 
              type="number" 
              v-model.number="floor"
              :class="{ 'has-error': errors.floor }"
              :min="1"
              :max="currentBuilding?.floors || 100"
            />
            <span v-if="errors.floor" class="error-text">{{ errors.floor }}</span>
          </div>
          
          <div class="form-group">
            <label>列 <span class="required">*</span></label>
            <input 
              type="number" 
              v-model.number="column"
              :class="{ 'has-error': errors.column }"
              :min="1"
              :max="currentBuilding?.columns || 100"
            />
            <span v-if="errors.column" class="error-text">{{ errors.column }}</span>
          </div>
        </div>
        
        <div class="form-group">
          <label>缺陷类型 <span class="required">*</span></label>
          <div class="radio-group">
            <label class="radio-item">
              <input type="radio" v-model="type" :value="DefectType.CRACK" />
              <span>裂纹</span>
            </label>
            <label class="radio-item">
              <input type="radio" v-model="type" :value="DefectType.LOOSENESS" />
              <span>松动</span>
            </label>
          </div>
        </div>
        
        <div class="form-group">
          <label>缺陷描述 <span class="required">*</span></label>
          <textarea 
            v-model="description"
            :class="{ 'has-error': errors.description }"
            rows="3"
            placeholder="请详细描述缺陷情况..."
          ></textarea>
          <span v-if="errors.description" class="error-text">{{ errors.description }}</span>
        </div>
        
        <div class="form-group">
          <label>巡检备注</label>
          <textarea 
            v-model="inspectionNote"
            rows="2"
            placeholder="可选的备注信息..."
          ></textarea>
        </div>
        
        <div class="form-group">
          <label>照片附件</label>
          <div class="photo-upload">
            <label class="upload-btn">
              <Camera :size="18" />
              <span>添加照片</span>
              <input type="file" accept="image/*" multiple @change="handleFileUpload" />
            </label>
          </div>
          
          <div v-if="photos.length > 0" class="photos-grid">
            <div v-for="photo in photos" :key="photo.id" class="photo-item">
              <img :src="photo.url" :alt="photo.name" />
              <button class="remove-photo" @click="removePhoto(photo.id)">
                <Trash2 :size="14" />
              </button>
              <span class="photo-name">{{ photo.name }}</span>
            </div>
          </div>
          
          <div v-else class="no-photos">
            <span>暂无照片</span>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn-secondary" @click="emit('close')">取消</button>
        <button class="btn-primary" @click="handleSubmit">
          {{ isEdit ? '保存修改' : '创建缺陷' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: var(--bg, #fff);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border, #e5e4e7);
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--text-h, #08060d);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--text, #6b6375);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  background: var(--code-bg, #f4f3ec);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-h, #08060d);
}

.form-group .required {
  color: #e53935;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

select,
input[type="number"],
textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  font-size: 14px;
  background: var(--bg, #fff);
  color: var(--text-h, #08060d);
  box-sizing: border-box;
}

select:focus,
input:focus,
textarea:focus {
  outline: none;
  border-color: var(--accent, #aa3bff);
  box-shadow: 0 0 0 3px var(--accent-bg, rgba(170, 59, 255, 0.1));
}

select:disabled {
  background: var(--code-bg, #f4f3ec);
  cursor: not-allowed;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

.has-error {
  border-color: #e53935 !important;
}

.error-text {
  display: block;
  color: #e53935;
  font-size: 12px;
  margin-top: 4px;
}

.radio-group {
  display: flex;
  gap: 20px;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-h, #08060d);
}

.radio-item input {
  width: 16px;
  height: 16px;
}

.photo-upload {
  margin-bottom: 12px;
}

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: var(--accent-bg, rgba(170, 59, 255, 0.1));
  border: 1px dashed var(--accent-border, rgba(170, 59, 255, 0.5));
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--accent, #aa3bff);
}

.upload-btn:hover {
  background: var(--accent, #aa3bff);
  color: white;
}

.upload-btn input {
  display: none;
}

.photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}

.photo-item {
  position: relative;
  border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px;
  overflow: hidden;
  background: var(--code-bg, #f4f3ec);
}

.photo-item img {
  width: 100%;
  height: 80px;
  object-fit: cover;
}

.remove-photo {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(229, 57, 53, 0.9);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-name {
  display: block;
  padding: 4px 6px;
  font-size: 11px;
  color: var(--text, #6b6375);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.no-photos {
  text-align: center;
  padding: 20px;
  background: var(--code-bg, #f4f3ec);
  border-radius: 6px;
  color: var(--text, #6b6375);
  font-size: 13px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border, #e5e4e7);
}

.btn-secondary,
.btn-primary {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: all 0.2s;
}

.btn-secondary {
  background: transparent;
  color: var(--text, #6b6375);
  border-color: var(--border, #e5e4e7);
}

.btn-secondary:hover {
  background: var(--code-bg, #f4f3ec);
}

.btn-primary {
  background: var(--accent, #aa3bff);
  color: white;
  border-color: var(--accent, #aa3bff);
}

.btn-primary:hover {
  background: #8a2be2;
}
</style>
