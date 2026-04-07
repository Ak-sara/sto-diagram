export const DEFAULT_NODE_WIDTH  = 160
export const DEFAULT_NODE_HEIGHT = 60

/**
 * Input node shape:
 * {
 *   id:        string
 *   label:     string
 *   type:      'block' | 'group' | 'logical' | 'neck'
 *
 *   Container membership rules:
 *     'group'   — explicit only: a node must set groupId pointing here to be a member
 *     'logical' — explicit (groupId) + absorbs all parentId descendants recursively;
 *                 escape hatch: set groupId pointing to a different container
 *     'neck'    — same as 'group' but incoming edge uses dashed-orange style
 *
 *   head:      string?  — id of the head child node inside a container (gets colored top bar)
 *   groupId:   string?  — explicit container membership
 *   parentId:  string?  — hierarchical parent; creates an edge (and triggers logical absorption)
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
    nodes.filter(n => n.type === 'group' || n.type === 'logical' || n.type === 'neck').map(n => n.id)
  )

  // containerChildren: containerId → Set<childId>  (direct members only)
  const containerChildren = new Map()
  containerIds.forEach(cid => containerChildren.set(cid, new Set()))

  // phase 1: membership resolution (in priority order — first match wins)
  //   1. head:    container's head node is always a member of that container
  //   2. groupId: explicit membership
  //   3. parentId → container: implicit membership for non-container nodes only
  containerIds.forEach(cid => {
    const headId = nodeMap.get(cid)?.head
    if (headId && nodeMap.has(headId)) containerChildren.get(cid).add(headId)
  })
  nodes.forEach(n => {
    if (n.groupId && containerChildren.has(n.groupId)) {
      containerChildren.get(n.groupId).add(n.id)
    } else if (!containerIds.has(n.id) && n.parentId && containerChildren.has(n.parentId)) {
      containerChildren.get(n.parentId).add(n.id)
    }
  })

  // childOf: childId → containerId (rebuilt after each phase)
  const childOf = new Map()
  const rebuildChildOf = () => {
    childOf.clear()
    containerChildren.forEach((children, cid) => {
      children.forEach(childId => childOf.set(childId, cid))
    })
  }
  rebuildChildOf()

  // phase 1.5: auto-place containers that have no explicit groupId.
  // A container is placed inside another container if its "anchor" node is already
  // inside that other container. Anchor = container's own parentId, or (if none)
  // its head node's parentId. This lets IT auto-nest inside DIAS because
  // ITGH.parentId = DH and DH is inside DIAS — no extra groupId needed.
  containerIds.forEach(cid => {
    if (childOf.has(cid)) return  // already placed via groupId
    const data = nodeMap.get(cid)
    const anchor = data.parentId ?? nodeMap.get(data?.head)?.parentId
    if (!anchor) return
    const parentContainer = childOf.get(anchor)
    if (parentContainer && parentContainer !== cid) {
      containerChildren.get(parentContainer).add(cid)
      childOf.set(cid, parentContainer)
    }
  })

  // phase 2: logical containers absorb all parentId descendants recursively.
  // Nodes already placed (childOf set via groupId) are never moved.
  let changed = true
  while (changed) {
    changed = false
    nodes.forEach(n => {
      if (!n.parentId || childOf.has(n.id) || containerIds.has(n.id)) return
      const parentContainerId = childOf.get(n.parentId)
      if (!parentContainerId) return
      if (nodeMap.get(parentContainerId)?.type !== 'logical') return
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
        edgeMap.set(edgeId, { id: edgeId, sources: [n.parentId], targets: [n.id], type: n.type === 'neck' ? 'neck' : 'regular' })
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
