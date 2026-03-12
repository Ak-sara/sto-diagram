export const DEFAULT_NODE_WIDTH  = 160
export const DEFAULT_NODE_HEIGHT = 60

/**
 * Input node shape:
 * {
 *   id:        string
 *   label:     string
 *   type:      'block' | 'neck' | 'group' | 'logical-group'
 *   role:      string?  — 'head' on a block → colored top bar
 *   head:      string?  — same as role but named more clearly
 *   groupId:   string?  — id of a logical-group this node is a member of
 *   parentId:  string?  — hierarchical parent
 *   edge:      'regular' | 'neck' | null
 *   picId:     string?  — mentor/pic node id; creates a 'pic' edge
 *   html:      string?
 *   width:     number?
 *   height:    number?
 * }
 *
 * Returns: { nodeMap, edgeMap, containerChildren, childOf, containerIds, topLevelContainerIds }
 */
export function normalize(nodes) {
  // ── nodeMap ───────────────────────────────────────────────────────────────
  const nodeMap = new Map(nodes.map(n => [n.id, {
    ...n,
    width:  n.width  || DEFAULT_NODE_WIDTH,
    height: n.height || DEFAULT_NODE_HEIGHT,
  }]))

  const edgeMap = new Map()

  // ── identify container nodes ───────────────────────────────────────────────
  const containerIds = new Set(
    nodes.filter(n => n.type === 'group' || n.type === 'logical-group').map(n => n.id)
  )

  // containerChildren: containerId → Set<childId>  (direct members only)
  const containerChildren = new Map()
  containerIds.forEach(cid => containerChildren.set(cid, new Set()))

  nodes.forEach(n => {
    // explicit membership (logical-group)
    if (n.groupId && containerChildren.has(n.groupId)) {
      containerChildren.get(n.groupId).add(n.id)
    }
    // implicit membership (group — direct parentId children)
    if (n.parentId && containerChildren.has(n.parentId)) {
      const parentData = nodeMap.get(n.parentId)
      if (parentData?.type === 'group') {
        containerChildren.get(n.parentId).add(n.id)
      }
    }
  })

  // childOf: childId → containerId (direct container)
  const childOf = new Map()
  containerChildren.forEach((children, cid) => {
    children.forEach(childId => childOf.set(childId, cid))
  })

  // ── phase 2: absorb all descendants into 'group' containers ───────────────
  let changed = true
  while (changed) {
    changed = false
    nodes.forEach(n => {
      if (!n.parentId || childOf.has(n.id) || containerIds.has(n.id)) return
      const parentContainerId = childOf.get(n.parentId)
      if (!parentContainerId) return
      if (nodeMap.get(parentContainerId)?.type !== 'group') return
      containerChildren.get(parentContainerId).add(n.id)
      childOf.set(n.id, parentContainerId)
      changed = true
    })
  }

  // ── build edge registry ───────────────────────────────────────────────────
  nodes.forEach(n => {
    if (n.parentId) {
      const isContainmentEdge = childOf.get(n.id) === n.parentId
                             || (n.groupId && n.groupId === n.parentId)
      if (!isContainmentEdge) {
        const edgeId = `e_${n.parentId}_${n.id}`
        edgeMap.set(edgeId, { id: edgeId, sources: [n.parentId], targets: [n.id], type: n.edge || 'regular' })
      }
    }
    if (n.picId) {
      const edgeId = `epic_${n.picId}_${n.id}`
      edgeMap.set(edgeId, { id: edgeId, sources: [n.picId], targets: [n.id], type: 'pic' })
    }
  })

  const topLevelContainerIds = [...containerIds].filter(cid => !childOf.has(cid))

  return { nodeMap, edgeMap, containerChildren, childOf, containerIds, topLevelContainerIds }
}
