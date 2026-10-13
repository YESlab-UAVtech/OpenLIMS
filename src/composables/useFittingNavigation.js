import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// The inert measurement row uses the same styles as the visible links.
export function useFittingNavigation(container, measurement, itemCount, budget) {
  const visibleCount = ref(itemCount.value)
  let observer
  let frame = 0
  let disposed = false

  function calculate() {
    const host = container.value
    const row = measurement.value
    if (!host || !row) return
    const items = [...row.children]
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0
    const widths = items.slice(0, itemCount.value).map((item) => item.getBoundingClientRect().width)
    const width = budget ? budget(host) : host.clientWidth
    const full = widths.reduce((sum, value) => sum + value, 0) + gap * Math.max(0, widths.length - 1)
    let count = widths.length
    if (full > width + 0.5) {
      const moreWidth = items.at(-1)?.getBoundingClientRect().width || 44
      let used = full
      while (count > 0 && used + moreWidth + (count ? gap : 0) > width + 0.5) {
        used -= widths[--count] + (count ? gap : 0)
      }
    }
    visibleCount.value = count
  }

  function schedule() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(calculate)
  }

  watch(itemCount, () => nextTick(schedule))
  onMounted(() => {
    observer = new ResizeObserver(schedule)
    if (container.value) {
      observer.observe(container.value)
      for (const child of container.value.children) observer.observe(child)
    }
    if (measurement.value) observer.observe(measurement.value)
    document.fonts?.ready.then(() => !disposed && schedule())
    window.addEventListener('resize', schedule)
    schedule()
  })
  onBeforeUnmount(() => {
    disposed = true
    observer?.disconnect()
    cancelAnimationFrame(frame)
    window.removeEventListener('resize', schedule)
  })
  return { visibleCount }
}
