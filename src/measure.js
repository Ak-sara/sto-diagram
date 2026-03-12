import { DEFAULT_NODE_WIDTH, DEFAULT_NODE_HEIGHT } from './normalizer.js'

const PAD_X    = 16   // horizontal padding inside block (each side)
const PAD_Y    = 10   // vertical padding inside block (each side)
const HEAD_H   = 16   // head bar height (matches renderer HEAD_BAR_H)

/**
 * For nodes that have `html` content but no explicit `width`/`height`,
 * renders the HTML off-screen, measures the natural size, and returns
 * a new data array with `width`/`height` set.
 *
 * Nodes with explicit width/height are left untouched.
 * Nodes without html are left untouched.
 */
export async function measureNodes(data) {
  const toMeasure = data.filter(n => n.html && (!n.width || !n.height))
  if (toMeasure.length === 0) return data

  // off-screen container
  const host = document.createElement('div')
  host.style.cssText = [
    'position:absolute', 'top:-99999px', 'left:-99999px',
    'visibility:hidden', 'pointer-events:none',
    'display:flex', 'flex-direction:column', 'gap:0',
  ].join(';')
  document.body.appendChild(host)

  // render each html node into a probe div
  const probes = toMeasure.map(node => {
    const div = document.createElement('div')
    const maxW = node.maxWidth || 280
    div.style.cssText = `display:inline-block;max-width:${maxW}px;font-size:12px;font-family:sans-serif;box-sizing:border-box;`
    div.innerHTML = node.html
    host.appendChild(div)
    return { node, div }
  })

  // single animation frame so the browser lays out all probes at once
  await new Promise(r => requestAnimationFrame(r))

  const measured = new Map()
  probes.forEach(({ node, div }) => {
    const rect   = div.getBoundingClientRect()
    const extraH = node.role === 'head' ? HEAD_H : 0
    measured.set(node.id, {
      width:  Math.max(Math.ceil(rect.width)  + PAD_X * 2,       node.width  || DEFAULT_NODE_WIDTH),
      height: Math.max(Math.ceil(rect.height) + PAD_Y * 2 + extraH, node.height || DEFAULT_NODE_HEIGHT),
    })
  })

  document.body.removeChild(host)

  // return new array — never mutates original objects
  return data.map(n => {
    const m = measured.get(n.id)
    return m ? { ...n, ...m } : n
  })
}
