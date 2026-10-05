<script setup lang="ts">
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

function onChange(event: { detail: { value: string } }) {
  emit('update:modelValue', event.detail.value)
}
</script>

<template>
  <picker mode="time" :value="modelValue" @change="onChange">
    <view class="control">{{ modelValue || '选择时间' }}</view>
  </picker>
</template>
