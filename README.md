# Ak-Sara Organisation Structure Diagram

This is a library to create Organisation Structure in 2 step, first we design the Structure(parent-child-group) of an Organization, then we assign user to some node in that design to finalize the presentation.

The rendered node is using svg <g> and we can use its 'data-id' to add event to the node.

## UMD Usage Example

<script src="https://cdn.jsdelivr.net/npm/@ak-sara/sto-diagram@0.1.0/dist/sto-diagram.ak-sara.js"></script>

<div id="chart" style="width:100vw;height:100vh"></div>

```javascript
const { StoChart } = StoDiagram
const data = [
  // ── Logical Directorate group ─────────────────────────────────────────
  { id: 'dir-corp', label: 'Directorate', type: 'logical-group', role: 'ceo' },

  // members of the logical group (groupId links them into the compound)
  { id: 'ceo', label: 'Chief Executive Officer', type: 'block', groupId: 'dir-corp' },
  { id: 'cco', label: 'Chief Commercial Officer', type: 'block', parentId: 'ceo', groupId: 'dir-corp' },
  { id: 'cfo', label: 'Chief Financial Officer', type: 'block', parentId: 'ceo', groupId: 'dir-corp' },

  // ── neck nodes (attached to Chief Executive Officer) ───────────────────
  { id: 'neck-grp', label: ' ', type: 'logical-group', parentId: 'ceo', edge: 'neck'},
  { id: 'ia', label: 'Internal Audits', groupId: 'neck-grp', picId:'cfo'},

  { id: 'acc',  label: 'Accounting', type: 'block', parentId: 'cfo'},
]
// adding user data from database, it is rendered inside nodes as html, after the stuctural design is done
var userCard=`<div style="display:flex;gap:10px;align-items:center;height:100%">
            <div><img src="{image}" class="sto-avatar"/></div>
            <div style="overflow:hidden">
              <div style="font-weight:700;font-size:12px;white-space:nowrap">{name}</div>
              <div style="color:#6b7280;font-size:11px">{title}</div>
              <div style="color:#2c7be5;font-size:11px;font-weight:600">{level}</div>
            </div>
          </div>`;

const user=[
  {stoid: 'cfo', name:"Amelia", title:"Chief Financial Officer", level:"Level I", image:"1.gif"},
]
const chart = new StoChart('#chart')
chart.load(data)
      .assign(user, userCard, { width: 200, height: 90 })
      .render()
```

## ESM guide
```bash
npm i @ak-sara/sto-diagram
```

```javascript
import { StoChart } from '@ak-sara/sto-diagram'
```
