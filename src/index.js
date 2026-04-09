import { normalize } from './normalizer.js'
import { computeLayout } from './layout.js'
import { render } from './renderer.js'
import { addInteraction } from './interaction.js'
import { measureNodes } from './measure.js'

const NS = 'http://www.w3.org/2000/svg'

export class StoChart {
  /**
   * @param {string|HTMLElement} container  CSS selector or DOM element
   * @param {object}             options
   * @param {boolean}            options.zoom       enable scroll zoom (default true)
   * @param {boolean}            options.pan        enable drag pan   (default true)
   * @param {number}             options.cardWidth  default width for user-card nodes
   * @param {number}             options.cardHeight default height for user-card nodes
   */
  constructor(container, options = {}) {
    this._container = typeof container === 'string'
      ? document.querySelector(container)
      : container

    this._options  = { zoom: true, pan: true, cardWidth: 200, cardHeight: 80, ...options }
    this._data     = []
    this._users    = []
    this._template = null
    this._svg      = null
    this._root     = null

    this._initSvg()
  }

  _initSvg() {
    this._svg = document.createElementNS(NS, 'svg')
    this._svg.setAttribute('width',  '100%')
    this._svg.setAttribute('height', '100%')
    this._svg.style.display = 'block'
    this._container.appendChild(this._svg)
  }

  /**
   * Load flat node array.
   * Returns `this` for chaining.
   */
  load(data) {
    this._data = data
    return this
  }

  /**
   * Assign user data to diagram nodes via a template.
   *
   * @param {Array}  users     Array of user objects. Each must have a `stoid` field
   *                           that matches a node `id` in the diagram data.
   * @param {string} template  HTML string with {fieldName} placeholders.
   *                           e.g. '<b>{name}</b><br>{title}'
   *                           {fieldName} is replaced by user[fieldName] (empty if missing).
   * @param {object} [size]    { width, height } for the card block.
   *                           Falls back to options.cardWidth / options.cardHeight.
   *
   * Returns `this` for chaining: chart.load(data).assign(users, tpl).render()
   */
  assign(users, template, size = {}) {
    this._users    = users    || []
    this._template = template || ''
    this._cardSize = {
      width:  size.width  || this._options.cardWidth,
      height: size.height || this._options.cardHeight,
    }
    return this
  }

  /**
   * Merge user assignments into data, returning a new array.
   * Nodes whose id matches a user's stoid get html + width + height injected.
   */
  _applyUsers(data) {
    if (!this._users.length || !this._template) return data

    const userMap = new Map(this._users.map(u => [u.stoid, u]))

    return data.map(node => {
      const user = userMap.get(node.id)
      if (!user) return node

      // replace {fieldName} placeholders; unknown keys become empty string
      const html = this._template.replace(/\{(\w+)\}/g, (_, key) => {
        const val = user[key]
        return val != null ? String(val) : ''
      })

      return {
        ...node,
        html,
        width:  node.width  || this._cardSize.width,
        height: node.height || this._cardSize.height,
      }
    })
  }

  /**
   * Run layout and render. Returns Promise<this>.
   */
  async render() {
    const assigned   = this._applyUsers(this._data)
    const sizedData  = await measureNodes(assigned)
    const graphData  = normalize(sizedData)
    const layoutResult = await computeLayout(graphData)

    this._root = render(layoutResult, graphData.nodeMap, graphData.edgeMap, this._svg)

    if (this._options.zoom || this._options.pan) {
      addInteraction(this._svg, this._root)
    }

    this._fitView(layoutResult)
    return this
  }

  _fitView(layoutResult) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

    function collect(nodes, offX = 0, offY = 0) {
      ;(nodes || []).forEach(n => {
        const ax = offX + n.x, ay = offY + n.y
        if (!isFinite(ax) || !isFinite(ay)) {
          console.warn(`[StoChart] fitView: non-finite position for node "${n.id}": x=${n.x}, y=${n.y} (parent offset ${offX},${offY}) — skipped from bounds`)
          return
        }
        minX = Math.min(minX, ax);  minY = Math.min(minY, ay)
        maxX = Math.max(maxX, ax + n.width); maxY = Math.max(maxY, ay + n.height)
        if (n.children && n.children.length) collect(n.children, ax, ay)
      })
    }
    collect(layoutResult.children)
    if (minX === Infinity) return

    const pad = 40
    const graphW = maxX - minX + pad * 2, graphH = maxY - minY + pad * 2
    const viewW  = this._container.clientWidth  || 800
    const viewH  = this._container.clientHeight || 600
    const scale  = Math.min(viewW / graphW, viewH / graphH, 1)
    const tx     = (viewW - graphW * scale) / 2 - minX * scale + pad * scale
    const ty     = (viewH - graphH * scale) / 2 - minY * scale + pad * scale

    this._root.setAttribute('transform', `translate(${tx},${ty}) scale(${scale})`)
  }
}

export default StoChart
