/**
 * Adds mouse wheel zoom and drag-to-pan to an SVG element.
 * Zoom targets the mouse cursor position.
 */
export function addInteraction(svgEl, rootGroup) {
  let isPanning  = false
  let startX     = 0
  let startY     = 0
  let translateX = 0
  let translateY = 0
  let scale      = 1

  const MIN_SCALE = 0.1
  const MAX_SCALE = 4

  function applyTransform() {
    rootGroup.setAttribute(
      'transform',
      `translate(${translateX},${translateY}) scale(${scale})`
    )
  }

  // zoom toward mouse cursor
  svgEl.addEventListener('wheel', (e) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    const next   = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
    const ratio  = next / scale

    const rect   = svgEl.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top

    translateX = mouseX - ratio * (mouseX - translateX)
    translateY = mouseY - ratio * (mouseY - translateY)
    scale      = next

    applyTransform()
  }, { passive: false })

  svgEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    isPanning = true
    startX    = e.clientX - translateX
    startY    = e.clientY - translateY
    svgEl.style.cursor = 'grabbing'
  })

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return
    translateX = e.clientX - startX
    translateY = e.clientY - startY
    applyTransform()
  })

  window.addEventListener('mouseup', () => {
    if (!isPanning) return
    isPanning = false
    svgEl.style.cursor = 'grab'
  })

  // touch support
  let lastTouchDist = null

  svgEl.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isPanning = true
      startX    = e.touches[0].clientX - translateX
      startY    = e.touches[0].clientY - translateY
    }
  }, { passive: true })

  svgEl.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isPanning) {
      translateX = e.touches[0].clientX - startX
      translateY = e.touches[0].clientY - startY
      applyTransform()
    } else if (e.touches.length === 2) {
      const dx   = e.touches[0].clientX - e.touches[1].clientX
      const dy   = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (lastTouchDist !== null) {
        const factor = dist / lastTouchDist
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
        applyTransform()
      }
      lastTouchDist = dist
    }
  }, { passive: true })

  svgEl.addEventListener('touchend', () => {
    isPanning     = false
    lastTouchDist = null
  }, { passive: true })

  svgEl.style.cursor = 'grab'
}
