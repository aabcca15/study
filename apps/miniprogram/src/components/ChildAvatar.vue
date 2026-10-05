<script setup lang="ts">
import { computed } from 'vue'
import type { ChildAvatarKey } from '@server-domain/types'
import { childAvatarOption } from '@server-domain/constants'
import { mix } from '@/utils/color'

const props = withDefaults(defineProps<{
  avatarKey?: ChildAvatarKey
  size?: number
}>(), {
  size: 42,
})

const option = computed(() => childAvatarOption(props.avatarKey))
const faceStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: mix(option.value.color, '#ffffff', 0.84),
}))
</script>

<template>
  <view class="child-face" :class="`is-${option.key}`" :style="faceStyle" />
</template>

<style scoped>
.child-face {
  display: block;
  flex: 0 0 auto;
  overflow: hidden;
  border-radius: 50%;
  background-image: url('../static/user_icon.png');
  background-repeat: no-repeat;
  background-size: 228% 242%;
  box-shadow: inset 0 0 0 1px rgba(91, 141, 239, 0.18);
}

.child-face.is-boy-blue { background-position: 6% 2%; }
.child-face.is-boy-cap { background-position: 94% 2%; }
.child-face.is-girl-flower { background-position: 6% 94%; }
.child-face.is-girl-bow { background-position: 94% 94%; }
</style>
