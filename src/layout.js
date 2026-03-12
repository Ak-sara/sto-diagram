import dagre from '@dagrejs/dagre'

const PAD_TOP    = 36   // space for compound label
const PAD_SIDE   = 20
const PAD_BOTTOM = 20

// Walk childOf upwards until we find a node that is in memberIds.
function topAncestor(nodeId, memberIds, childOf) {
  if (memberIds.has(nodeId)) return nodeId
  const parent = childOf.get(nodeId)
  if (!parent) return null
  return topAncestor(parent, memberIds, childOf)
}

/**
 * Recursively lay out a compound's direct members using dagre.
 * Returns { children, width, height } with coords relative to compound top-left.
 * Edges are NOT returned — the renderer computes them from absolute positions.
 */
function layoutGroup(memberIds, nodeMap, edgeMap, containerChildren, containerIds, childOf) {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: 'TB', nodesep: 30, ranksep: 50, marginx: PAD_SIDE, marginy: PAD_TOP })
  g.setDefaultEdgeLabel(() => ({}))

  const subLayouts = new Map()
  memberIds.forEach(mid => {
    if (containerIds.has(mid)) {
      const sub = layoutGroup(containerChildren.get(mid), nodeMap, edgeMap, containerChildren, containerIds, childOf)
      subLayouts.set(mid, sub)
      g.setNode(mid, { width: sub.width, height: sub.height })
    } else {
      const d = nodeMap.get(mid)
      g.setNode(mid, { width: d.width, height: d.height })
    }
  })

  // Add edges only to guide dagre's node placement — we don't use dagre's edge paths.
  edgeMap.forEach((edge, edgeId) => {
    const s = topAncestor(edge.sources[0], memberIds, childOf)
    const t = topAncestor(edge.targets[0], memberIds, childOf)
    if (s && t && s !== t) g.setEdge(s, t, {}, edgeId)
  })

  dagre.layout(g)

  const children = []
  memberIds.forEach(mid => {
    const n = g.node(mid)
    if (!n) return
    const child = { id: mid, x: n.x - n.width / 2, y: n.y - n.height / 2, width: n.width, height: n.height }
    if (subLayouts.has(mid)) {
      child.children = subLayouts.get(mid).children
    }
    children.push(child)
  })

  const gh = g.graph()
  return {
    children,
    width:  (gh.width  || 0) + PAD_SIDE * 2,
    height: (gh.height || 0) + PAD_TOP + PAD_BOTTOM,
  }
}

export async function computeLayout({ nodeMap, edgeMap, containerChildren, containerIds, childOf, topLevelContainerIds }) {
  const g = new dagre.graphlib.Graph({ multigraph: true })
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 })
  g.setDefaultEdgeLabel(() => ({}))

  const subLayouts = new Map()
  topLevelContainerIds.forEach(cid => {
    const sub = layoutGroup(containerChildren.get(cid), nodeMap, edgeMap, containerChildren, containerIds, childOf)
    subLayouts.set(cid, sub)
    g.setNode(cid, { width: sub.width, height: sub.height })
  })

  nodeMap.forEach((data, id) => {
    if (!containerIds.has(id) && !childOf.has(id)) {
      g.setNode(id, { width: data.width, height: data.height })
    }
  })

  function rootRep(id) {
    const c = childOf.get(id)
    return c ? rootRep(c) : id
  }

  edgeMap.forEach((edge, edgeId) => {
    const s = rootRep(edge.sources[0]), t = rootRep(edge.targets[0])
    if (s === t) return
    if (g.hasNode(s) && g.hasNode(t)) g.setEdge(s, t, {}, edgeId)
  })

  dagre.layout(g)

  const children = []
  g.nodes().forEach(id => {
    const n = g.node(id)
    const child = { id, x: n.x - n.width / 2, y: n.y - n.height / 2, width: n.width, height: n.height }
    if (subLayouts.has(id)) {
      child.children = subLayouts.get(id).children
    }
    children.push(child)
  })

  return { id: 'root', children }
}
