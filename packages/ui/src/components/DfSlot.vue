<script setup lang="ts">
import { useCordis } from '@df/vue'

defineProps<{
  name: string
}>()

const ctx = useCordis()
</script>

<template>
  <template v-for="item in ctx.ui.slot(name)" :key="item.id">
    <component :is="item.component" v-bind="item.props" />
  </template>
  <slot v-if="ctx.ui.slot(name).length === 0" />
</template>
