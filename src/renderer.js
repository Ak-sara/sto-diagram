const NS  = 'http://www.w3.org/2000/svg'
const NSH = 'http://www.w3.org/1999/xhtml'

const HEAD_BAR_H  = 16
const GROUP_PAD   = 16   // padding around group bbox

const COLORS = {
  block: {
    fill: '#ffffff', stroke: '#2c7be5', strokeWidth: 1.5,
    headBar: '#2c7be5', headText: '#ffffff',
    anchor: '#2c7be5', neckAnchor: '#e67e22',
  },
  group: {
    fill: '#eff6ff', stroke: '#1d4ed8', strokeWidth: 2.5,
    headBar: '#1d4ed8', headText: '#ffffff',
    anchor: '#1d4ed8', neckAnchor: '#e67e22',
  },
  neck: {
    fill: '#fff7f0', stroke: '#e67e22', strokeWidth: 1.5,
    headBar: '#c0571a', headText: '#ffffff',
    anchor: '#e67e22', neckAnchor: '#e67e22',
  },
}

const EDGE_STYLE = {
  regular: { stroke: '#2c7be5', dasharray: 'none', width: 1.5 },
  neck:    { stroke: '#e67e22', dasharray: '6,3',  width: 1.5 },
  pic:     { stroke: '#16a34a', dasharray: '4,3',  width: 1.5 },  // green dashed
}

function svgEl(tag, attrs = {}, parent = null) {
  const e = document.createElementNS(NS, tag)
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v))
  if (parent) parent.appendChild(e)
  return e
}

// ── resolve head id from logical-group data ───────────────────────────────────
function resolveHeadId(groupData, nodeMap) {
  if (groupData.head && nodeMap.has(groupData.head)) return groupData.head
  if (groupData.role && nodeMap.has(groupData.role)) return groupData.role
  return null
}

// ── build absolute position map for all nodes ─────────────────────────────────
function buildAbsPosMap(nodes, offX, offY, result) {
  ;(nodes || []).forEach(n => {
    const ax = offX + n.x, ay = offY + n.y
    result.set(n.id, { x: ax, y: ay, w: n.width, h: n.height })
    if (n.children) buildAbsPosMap(n.children, ax, ay, result)
  })
}

// ── compute anchor point on a node's border ───────────────────────────────────
// pos = { x, y, w, h } (absolute top-left)
// isSource: true = outgoing (bottom border), false = incoming (top border)
// edgeType: 'regular' | 'neck' | 'pic'
function anchorPoint(pos, nodeData, isSource, edgeType) {
  const isContainer = nodeData.type === 'logical-group' || nodeData.type === 'group'
  // ±8 offset rules (same for both blocks and containers):
  //   source bottom: neck/pic → +8 (right),  regular → -8 (left)
  //   target top:    pic      → +8 (right),  others  → -8 (left)
  const offX = isSource
    ? (edgeType === 'neck' || edgeType === 'pic' ?  8 : -8)
    : (edgeType === 'pic'                        ?  8 : -8)
  const cx = pos.x + pos.w / 2 + offX
  return isSource
    ? { x: cx, y: pos.y + pos.h }   // bottom border
    : { x: cx, y: pos.y }           // top border
}

// ── per-type elbow offsets (px) ───────────────────────────────────────────────
// src = stub below the outgoing anchor, tgt = stub above the incoming anchor
const ELBOW = {
  regular: { src: 30, tgt: 10 },
  neck:    { src: 10, tgt: 10 },
  pic:     { src: 10, tgt: 20 },
}

// ── low-level SVG path + arrowhead helpers ────────────────────────────────────
function drawPath(pts, style, container) {
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  svgEl('path', {
    d, fill: 'none', stroke: style.stroke,
    'stroke-width': style.width, 'stroke-dasharray': style.dasharray,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round',
  }, container)
}

function drawArrow(end, before, style, container) {
  const angle = Math.atan2(end.y - before.y, end.x - before.x) * 180 / Math.PI
  svgEl('polygon', {
    points: '0,-4 8,0 0,4', fill: style.stroke,
    transform: `translate(${end.x},${end.y}) rotate(${angle})`,
  }, container)
}

// ── bus-style edge group: one shared horizontal per (source, type) ────────────
// All edges in a group share the same source and edge type.
// A single horizontal "bus" is drawn at busY, with vertical drops to each target.
function drawEdgeGroup(edges, nodeMap, absMap, container, stagger = 0) {
  if (!edges.length) return
  const edgeType = edges[0].type
  const style    = EDGE_STYLE[edgeType] || EDGE_STYLE.regular
  const { src: srcOff, tgt: tgtOff } = ELBOW[edgeType] || ELBOW.regular

  const srcId  = edges[0].sources[0]
  const srcPos = absMap.get(srcId)
  if (!srcPos) return
  const srcAnchor = anchorPoint(srcPos, nodeMap.get(srcId) || {}, true, edgeType)
  const busY      = srcAnchor.y + srcOff + stagger

  // Resolve all target anchor points (skip missing nodes)
  const targets = edges.flatMap(e => {
    const tgtPos = absMap.get(e.targets[0])
    if (!tgtPos) return []
    return [anchorPoint(tgtPos, nodeMap.get(e.targets[0]) || {}, false, edgeType)]
  })
  if (!targets.length) return

  // Horizontal bus spans from min to max of all X positions (source + targets)
  const allXs = [srcAnchor.x, ...targets.map(t => t.x)]
  const minX  = Math.min(...allXs)
  const maxX  = Math.max(...allXs)

  // 1. Source stub down to bus
  drawPath([srcAnchor, { x: srcAnchor.x, y: busY }], style, container)

  // 2. Horizontal bus
  if (maxX > minX) drawPath([{ x: minX, y: busY }, { x: maxX, y: busY }], style, container)

  // 3. Vertical drop from bus to each target (with target stub + arrowhead)
  targets.forEach(end => {
    const elbowTgtY = end.y - tgtOff
    if (elbowTgtY > busY) {
      drawPath([{ x: end.x, y: busY }, { x: end.x, y: elbowTgtY }, end], style, container)
      drawArrow(end, { x: end.x, y: elbowTgtY }, style, container)
    } else {
      drawPath([{ x: end.x, y: busY }, end], style, container)
      drawArrow(end, { x: end.x, y: busY }, style, container)
    }
  })
}

// ── draw a single block (absolute position) ───────────────────────────────────
function drawBlock(ax, ay, data, elkNode, isHead, nodeLayer) {
  const type   = data.type || 'block'
  const colors = COLORS[type] || COLORS.block
  const { width, height } = elkNode

  const g = svgEl('g', {
    class:     `sto-node sto-node--${type}${isHead ? ' sto-node--head' : ''}`,
    'data-id': elkNode.id,
    transform: `translate(${ax},${ay})`,
  }, nodeLayer)

  // shadow
  svgEl('rect', { x: 2, y: 2, width, height, rx: 5, ry: 5,
    fill: 'rgba(0,0,0,0.07)', stroke: 'none' }, g)

  // main box
  svgEl('rect', { x: 0, y: 0, width, height, rx: 5, ry: 5,
    fill: colors.fill, stroke: colors.stroke,
    'stroke-width': colors.strokeWidth,
    'stroke-dasharray': type === 'neck' ? '6,3' : 'none',
  }, g)

  // group: colored left strip
  if (type === 'group') {
    const clipId = `clip-grp-${elkNode.id}`
    const defs   = svgEl('defs', {}, g)
    const clip   = document.createElementNS(NS, 'clipPath')
    clip.setAttribute('id', clipId)
    svgEl('rect', { x: 0, y: 0, width, height, rx: 5, ry: 5 }, clip)
    defs.appendChild(clip)
    svgEl('rect', { x: 0, y: 0, width: 5, height,
      fill: colors.stroke, 'clip-path': `url(#${clipId})` }, g)
  }

  // head: colored top bar
  if (isHead) {
    const clipId = `clip-head-${elkNode.id}`
    const defs   = svgEl('defs', {}, g)
    const clip   = document.createElementNS(NS, 'clipPath')
    clip.setAttribute('id', clipId)
    svgEl('rect', { x: 0, y: 0, width, height, rx: 5, ry: 5 }, clip)
    defs.appendChild(clip)
    svgEl('rect', { x: 0, y: 0, width, height: HEAD_BAR_H,
      fill: colors.headBar, 'clip-path': `url(#${clipId})` }, g)
    svgEl('text', {
      x: width / 2, y: HEAD_BAR_H / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'sans-serif', 'font-size': '9', 'font-weight': '700',
      fill: colors.headText, 'letter-spacing': '0.8',
    }, g).textContent = 'HEAD'
  }

  // label
  const textY0 = isHead ? HEAD_BAR_H : 0
  const textH  = height - textY0
  const textX  = type === 'group' ? 5 + (width - 5) / 2 : width / 2

  if (data.html) {
    // padding matches measure.js constants (PAD_X=16, PAD_Y=10)
    const padX  = type === 'group' ? 21 : 16   // +5 for the left strip on group
    const padY  = 10
    const foX   = padX
    const foY   = textY0 + padY
    const foW   = Math.max(width  - padX - 8,  1)
    const foH   = Math.max(textH  - padY * 2,  1)
    const fo    = svgEl('foreignObject', { x: foX, y: foY, width: foW, height: foH }, g)
    const div   = document.createElementNS(NSH, 'div')
    div.innerHTML     = data.html
    div.style.cssText = 'width:100%;height:100%;overflow:hidden;font-size:12px;font-family:sans-serif;box-sizing:border-box;'
    fo.appendChild(div)
  } else {
    svgEl('text', {
      x: textX, y: textY0 + textH / 2,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-family': 'sans-serif', 'font-size': '12',
      'font-weight': (isHead || type === 'group') ? '700' : '400',
      fill: type === 'group' ? colors.stroke : '#1a1a1a',
    }, g).textContent = data.label || elkNode.id
  }

  // anchor dots — positions MUST match port offsets in normalizer.js
  svgEl('circle', { cx: width / 2 - 8, cy: 0,      r: 3, fill: colors.anchor }, g)       // top-left  (parent)
  svgEl('circle', { cx: width / 2 + 8, cy: 0,      r: 3, fill: '#16a34a' }, g)            // top-right (pic/mentor)
  svgEl('circle', { cx: width / 2 - 8, cy: height, r: 3, fill: colors.anchor }, g)       // bot-left  (regular)
  svgEl('circle', { cx: width / 2 + 8, cy: height, r: 3, fill: colors.neckAnchor }, g)   // bot-right (neck)
}

// ── draw compound/group backgrounds ──────────────────────────────────────────
function drawBackgrounds(nodes, offX, offY, nodeMap, absMap, bgLayer) {
  ;(nodes || []).forEach(n => {
    const ax   = offX + n.x, ay = offY + n.y
    const data = nodeMap.get(n.id) || {}

    if (data.type === 'logical-group') {
      const g = svgEl('g', { transform: `translate(${ax},${ay})` }, bgLayer)
      svgEl('rect', { x: 0, y: 0, width: n.width, height: n.height, rx: 8, ry: 8,
        fill: '#f0f7ff', stroke: '#93c5fd',
        'stroke-width': 1.5, 'stroke-dasharray': '8,4' }, g)
      if (data.label && data.label.trim()) {
        svgEl('text', { x: 12, y: 18,
          'text-anchor': 'start', 'dominant-baseline': 'middle',
          'font-family': 'sans-serif', 'font-size': '10', 'font-weight': '700',
          fill: '#3b82f6', 'letter-spacing': '1' }, g).textContent = data.label.toUpperCase()
      }
      // top anchor dots (parent = blue left, pic = green right)
      svgEl('circle', { cx: n.width / 2 - 8, cy: 0, r: 3, fill: '#2c7be5' }, g)
      svgEl('circle', { cx: n.width / 2 + 8, cy: 0, r: 3, fill: '#16a34a' }, g)
      drawBackgrounds(n.children, ax, ay, nodeMap, absMap, bgLayer)
    }

    if (data.type === 'group') {
      const g = svgEl('g', { transform: `translate(${ax},${ay})` }, bgLayer)
      svgEl('rect', { x: 0, y: 0, width: n.width, height: n.height, rx: 8, ry: 8,
        fill: '#eff6ff', stroke: '#1d4ed8',
        'stroke-width': 1.5, 'stroke-dasharray': '6,3' }, g)
      if (data.label && data.label.trim()) {
        svgEl('text', { x: 12, y: 18,
          'text-anchor': 'start', 'dominant-baseline': 'middle',
          'font-family': 'sans-serif', 'font-size': '10', 'font-weight': '700',
          fill: '#1d4ed8', 'letter-spacing': '1' }, g).textContent = data.label.toUpperCase()
      }
      // top anchor dots (parent = blue left, pic = green right)
      svgEl('circle', { cx: n.width / 2 - 8, cy: 0, r: 3, fill: '#1d4ed8' }, g)
      svgEl('circle', { cx: n.width / 2 + 8, cy: 0, r: 3, fill: '#16a34a' }, g)
      drawBackgrounds(n.children, ax, ay, nodeMap, absMap, bgLayer)
    }
  })
}

// ── draw all blocks (flat, absolute coords) ───────────────────────────────────
function drawAllBlocks(nodes, offX, offY, nodeMap, nodeLayer, inheritedHeadId) {
  ;(nodes || []).forEach(n => {
    const ax   = offX + n.x, ay = offY + n.y
    const data = nodeMap.get(n.id) || {}

    if (data.type === 'logical-group' || data.type === 'group') {
      // compound node — recurse into children, compound itself is drawn in bgLayer
      const headId = resolveHeadId(data, nodeMap)
      drawAllBlocks(n.children, ax, ay, nodeMap, nodeLayer, headId)
    } else {
      const isHead = n.id === inheritedHeadId || data.role === 'head'
      drawBlock(ax, ay, data, n, isHead, nodeLayer)
    }
  })
}

// ── main entry ────────────────────────────────────────────────────────────────
export function render(layoutResult, nodeMap, edgeMap, svgElement) {
  while (svgElement.firstChild) svgElement.removeChild(svgElement.firstChild)

  const root = svgEl('g', { class: 'sto-root' }, svgElement)

  // Layer 1 — compound/group backgrounds (below everything)
  const bgLayer   = svgEl('g', { class: 'sto-bg' }, root)
  // Layer 2 — all edges
  const edgeLayer = svgEl('g', { class: 'sto-edges' }, root)
  // Layer 3 — all node blocks
  const nodeLayer = svgEl('g', { class: 'sto-nodes' }, root)

  // build absolute position map (needed for group bbox calculation)
  const absMap = new Map()
  buildAbsPosMap(layoutResult.children, 0, 0, absMap)

  // pass 1: backgrounds
  drawBackgrounds(layoutResult.children, 0, 0, nodeMap, absMap, bgLayer)

  // pass 2: edges — group by (source, type) for shared horizontal bus
  const edgeGroups = new Map()
  edgeMap.forEach(edgeMeta => {
    const key = `${edgeMeta.sources[0]}::${edgeMeta.type}`
    if (!edgeGroups.has(key)) edgeGroups.set(key, [])
    edgeGroups.get(key).push(edgeMeta)
  })

  // Assign stagger to single-target groups that share the same base busY.
  // Groups are sorted by source X so the wire furthest left turns first.
  // Multi-target buses (real parent→children) always use stagger=0.
  const STAGGER_STEP = 15   // px between stagger levels
  const staggerMap   = new Map()

  // bucket: rounded(baseY + edgeType) → [ {key, srcX} ]
  const busYBuckets = new Map()
  edgeGroups.forEach((grp, key) => {
    if (grp.length > 1) return   // multi-target buses: no stagger needed
    const srcId  = grp[0].sources[0]
    const srcPos = absMap.get(srcId)
    if (!srcPos) return
    const { src: srcOff } = ELBOW[grp[0].type] || ELBOW.regular
    const srcAnchor = anchorPoint(srcPos, nodeMap.get(srcId) || {}, true, grp[0].type)
    const baseY  = Math.round(srcAnchor.y + srcOff)
    const bucket = `${baseY}::${grp[0].type}`
    if (!busYBuckets.has(bucket)) busYBuckets.set(bucket, [])
    busYBuckets.get(bucket).push({ key, srcX: srcAnchor.x })
  })

  busYBuckets.forEach(entries => {
    if (entries.length < 2) return   // no conflict at this Y level
    // sort left-to-right so leftmost wire turns soonest (smallest stagger)
    entries.sort((a, b) => a.srcX - b.srcX)
    entries.forEach(({ key }, i) => staggerMap.set(key, i * STAGGER_STEP))
  })

  edgeGroups.forEach((group, key) =>
    drawEdgeGroup(group, nodeMap, absMap, edgeLayer, staggerMap.get(key) || 0)
  )

  // pass 3: blocks
  drawAllBlocks(layoutResult.children, 0, 0, nodeMap, nodeLayer, null)

  return root
}
