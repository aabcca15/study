import { defineStore } from 'pinia'
import dayjs from 'dayjs'

export const useUiStore = defineStore('ui', {
  state: () => ({
    selectedDate: dayjs().format('YYYY-MM-DD'),
  }),
})
