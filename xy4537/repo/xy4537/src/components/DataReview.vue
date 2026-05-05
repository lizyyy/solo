<template>
  <div class="space-y-6">
    <div class="bg-white rounded-xl shadow-sm border p-6">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-medium text-gray-900">运动员数据浏览</h3>
        <div class="flex items-center space-x-2">
          <input
            v-model="searchTerm"
            type="text"
            placeholder="搜索运动员姓名或队伍..."
            class="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
          />
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">排名</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">运动员</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">队伍</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">年龄</th>
              <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">总分</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">申诉数</th>
              <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr
              v-for="athlete in filteredAthletes"
              :key="athlete.id"
              class="hover:bg-gray-50"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium"
                  :class="getRankBadgeClass(athlete.rank)">
                  {{ athlete.rank }}
                </span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-medium text-gray-900">{{ athlete.name }}</div>
                <div class="text-xs text-gray-500">{{ athlete.id }}</div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {{ athlete.team }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-center">
                {{ athlete.age }}岁
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-right">
                <span class="text-sm font-semibold text-gray-900">{{ athlete.totalScore.toFixed(2) }}</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <span v-if="getAppealCount(athlete.id) > 0" class="tag tag-warning">
                  {{ getAppealCount(athlete.id) }}
                </span>
                <span v-else class="text-sm text-gray-400">0</span>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-center">
                <button
                  @click="selectAthlete(athlete)"
                  class="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  查看详情
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="selectedAthlete" class="bg-white rounded-xl shadow-sm border p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg font-medium text-gray-900">
            {{ selectedAthlete.name }} - 详细数据
          </h3>
          <p class="text-sm text-gray-500">{{ selectedAthlete.team }} · {{ selectedAthlete.age }}岁</p>
        </div>
        <button
          @click="selectedAthlete = null"
          class="text-gray-400 hover:text-gray-600"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h4 class="text-sm font-medium text-gray-900 mb-3">各项目成绩</h4>
          <div class="space-y-3">
            <div
              v-for="event in selectedAthlete.events"
              :key="event.event"
              class="p-4 bg-gray-50 rounded-lg"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="font-medium text-gray-900">{{ event.event }}</span>
                <span class="text-lg font-semibold text-blue-600">
                  {{ event.scoreStats?.total?.avg?.toFixed(2) || '-' }}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div class="text-center">
                  <p class="text-gray-500">难度分</p>
                  <p class="font-medium text-gray-900">{{ event.scoreStats?.difficulty?.avg?.toFixed(2) || '-' }}</p>
                </div>
                <div class="text-center">
                  <p class="text-gray-500">执行分</p>
                  <p class="font-medium text-gray-900">{{ event.scoreStats?.execution?.avg?.toFixed(2) || '-' }}</p>
                </div>
                <div class="text-center">
                  <p class="text-gray-500">扣分</p>
                  <p class="font-medium" :class="event.scoreStats?.penalty?.avg > 0 ? 'text-red-600' : 'text-gray-900'">
                    {{ event.scoreStats?.penalty?.avg?.toFixed(2) || '0.00' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 class="text-sm font-medium text-gray-900 mb-3">动作段详情</h4>
          <div class="space-y-3 max-h-96 overflow-y-auto">
            <template v-for="event in selectedAthlete.events" :key="event.event">
              <div
                v-for="segment in event.segments"
                :key="`${event.event}-${segment.segmentNumber}`"
                class="p-3 border rounded-lg"
                :class="segment.appeals?.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200'"
              >
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-xs font-medium text-gray-500">{{ event.event }}</span>
                    <p class="font-medium text-gray-900">{{ segment.description }}</p>
                  </div>
                  <div v-if="segment.declaration" class="text-right">
                    <span class="text-sm font-semibold text-blue-600">
                      {{ segment.declaration.declared_difficulty }}
                    </span>
                    <p class="text-xs text-gray-500">
                      {{ segment.declaration.declared_value }}分
                    </p>
                  </div>
                </div>
                
                <div v-if="segment.timecode" class="mt-2 text-xs text-gray-500">
                  时间码: {{ segment.timecode.start }} - {{ segment.timecode.end }}
                </div>

                <div v-if="segment.appeals?.length > 0" class="mt-2 pt-2 border-t border-amber-200">
                  <p class="text-xs font-medium text-amber-700 mb-1">相关申诉 ({{ segment.appeals.length }})</p>
                  <div
                    v-for="appeal in segment.appeals"
                    :key="appeal.appeal_id"
                    class="p-2 bg-white rounded text-xs"
                  >
                    <span class="font-medium text-amber-800">{{ appeal.appeal_id }}</span>
                    <p class="text-gray-600 mt-1">{{ appeal.complaint?.substring(0, 60) }}{{ appeal.complaint?.length > 60 ? '...' : '' }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  alignedData: Object
})

const searchTerm = ref('')
const selectedAthlete = ref(null)

const athletes = computed(() => 
  props.alignedData?.athletes || []
)

const filteredAthletes = computed(() => {
  if (!searchTerm.value) return athletes.value
  
  const term = searchTerm.value.toLowerCase()
  return athletes.value.filter(a => 
    a.name.toLowerCase().includes(term) ||
    a.team.toLowerCase().includes(term)
  )
})

function getRankBadgeClass(rank) {
  if (rank === 1) return 'bg-yellow-400 text-white'
  if (rank === 2) return 'bg-gray-300 text-white'
  if (rank === 3) return 'bg-amber-600 text-white'
  return 'bg-gray-100 text-gray-600'
}

function getAppealCount(athleteId) {
  if (!props.alignedData?.rawData?.appeals?.appeals) return 0
  return props.alignedData.rawData.appeals.appeals.filter(a => a.athlete_id === athleteId).length
}

function selectAthlete(athlete) {
  selectedAthlete.value = athlete
}
</script>
