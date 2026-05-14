<template>
  <div class="address-form">
    <el-page-header @back="goBack" :content="isEdit ? '编辑地址记录' : '新增地址记录'" />

    <el-card shadow="hover" style="margin-top: 20px; max-width: 1000px;">
      <el-form :model="form" label-width="140px" :rules="rules" ref="formRef">
        <el-form-item label="原始地址" prop="original_address">
          <el-input v-model="form.original_address" type="textarea" :rows="3" placeholder="请输入完整的原始地址" />
        </el-form-item>

        <el-divider content-position="left">地理编码信息</el-divider>

        <el-form-item label="地理编码结果">
          <el-input v-model="form.geocoding_result" type="textarea" :rows="4" placeholder='JSON格式，例如: {"lat": 39.9142, "lng": 116.4830}' />
        </el-form-item>

        <el-form-item label="候选坐标">
          <el-input v-model="form.candidate_coordinates" type="textarea" :rows="4" placeholder='JSON数组格式，例如: [{"lat": 39.9142, "lng": 116.4830, "name": "..."}]' />
        </el-form-item>

        <el-divider content-position="left">配送与命中信息</el-divider>

        <el-form-item label="配送范围">
          <el-input v-model="form.delivery_range" placeholder="请输入配送范围，如: 朝阳区三环内" />
        </el-form-item>

        <el-form-item label="命中报告">
          <el-input v-model="form.hit_report" type="textarea" :rows="3" placeholder="请输入命中报告结果" />
        </el-form-item>

        <el-divider content-position="left">人工纠偏（可选）</el-divider>

        <el-form-item label="人工纠偏结果">
          <el-input v-model="form.manual_correction" type="textarea" :rows="3" placeholder="如有需要，请输入人工纠偏的地址信息" />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="submitForm" :loading="submitting" size="large">
            <el-icon><Check /></el-icon>
            {{ isEdit ? '保存修改' : '创建记录' }}
          </el-button>
          <el-button @click="resetForm" size="large">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, RefreshLeft } from '@element-plus/icons-vue'
import { getAddressDetail, createAddress, updateAddress } from '@/api/address'

const route = useRoute()
const router = useRouter()
const formRef = ref(null)
const submitting = ref(false)
const isEdit = ref(false)
const addressId = ref(null)

const form = reactive({
  original_address: '',
  geocoding_result: '',
  candidate_coordinates: '',
  delivery_range: '',
  hit_report: '',
  manual_correction: ''
})

const rules = {
  original_address: [
    { required: true, message: '请输入原始地址', trigger: 'blur' },
    { min: 5, message: '地址长度不能少于5个字符', trigger: 'blur' }
  ]
}

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
}

const fetchDetail = async () => {
  try {
    const detail = await getAddressDetail(addressId.value)
    Object.keys(form).forEach(key => {
      if (detail[key] !== undefined) {
        form[key] = detail[key]
      }
    })
  } catch (error) {
    console.error('获取详情失败:', error)
  }
}

const submitForm = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await updateAddress(addressId.value, form)
      ElMessage.success('地址记录更新成功')
    } else {
      await createAddress(form)
      ElMessage.success('地址记录创建成功')
    }
    router.push('/')
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

const goBack = () => {
  router.back()
}

onMounted(() => {
  if (route.params.id) {
    isEdit.value = true
    addressId.value = route.params.id
    fetchDetail()
  }
})
</script>

<style scoped>
.address-form {
  padding-bottom: 30px;
}
</style>
