
# ─│    ┬ ┴ ├ ┤ ┼    ┬ ┴ ├ ┤ ┼    ┌ ┐ └ ┘

                    ┌───┴───┐
                    ┤ block ├
                    └───┬───┘
                        ┼.─.─.─.─.─.─.─.─.─.─.─.─.─.─.─.┐
                        │                         ┌─────┴──────┐                                                  
     ┌──────────────────┼──────┐                  ┤ Neck block ├  
┌────┴───┐                 ┌───┴───┐              └─────┬──────┘  
┤ block  ├                 ┤ block ├
└────┬───┘                 └───┬───┘
     │                         │
┌────┴───┐      ┌──────────────┴────────────────────────┐
┤ block  ├      │              ┌─────┴─────┐            │   
└────┬───┘      │              ┤ sub block ├            │
                │              └─────┬─────┘            │
                │      ┌─────────────┼─────┐            │
                ┤  ┌───┴───┐           ┌───┴───┐        ├
                │  ┤ block ├           ┤ block ├        │
                │  └───┬───┘           └───┬───┘        │
                │                          │            │
                └──────────────┬───────────┼────────────┘
             ┌─────────────────┼           │ 
             │                             │ 
    ┌────────┴────────┐                ┌───┴───┐
    ┤ sub block child ├                ┤ block ├
    └────────┬────────┘                └───┬───┘

## Description
- a block is having top-bottom-left-right anchor
- block can be act as group, neck, or just a block
- either block or group block can be child of another block or group block
- block or group block can be a child of another child block inside a group block

# Block
other than group block content should capable of rendering html content, the idea is user can make view like:
┌────────┴──────────────┐
│┌───────┬─────────────┐│
┤│       │ Name: xxx   │├
┤│ image │ Role: yyy   │├
┤│       │ Level: zzz  │├
│└───────┴─────────────┘│
└────────┬──────────────┘

## Data Component

Group Block:  Company -[have child]-> Division/Departement(or Neck block) -[contain of, head of]-> Position
Block Render: Position * <--> 1 User

* so User data will be assigned to multiple position
* a group block probably need properties like: group head, child of, is logical(wheter it is a division or just logical grouping)


# Name is available. Steps to publish:
           
  # 1. Login (once)                                                                                                                                    
  bun login        # or: npm login                                                                                                                     
                                                                                                                                                       
  # 2. Build latest dist                                                                                                                               
  bun run build                                                                                                                                        
                                                                                                                                                       
  # 3. Publish                                                                                                                                         
  bun publish

  bun publish is equivalent to npm publish — it reads package.json, uploads only the files listed (dist/), and pushes to the npm registry. With the
  files field set, the published package will contain only:
  dist/sto-diagram.js        (ESM, 54 KB)
  dist/sto-diagram.umd.js    (UMD, 54 KB)
  package.json

  Consumers install it with npm install sto-diagram and import as:
  // ESM (Svelte/Nuxt)
  import { StoChart } from 'sto-diagram'

  // Plain HTML (CDN)
  <script src="https://cdn.jsdelivr.net/npm/sto-diagram/dist/sto-diagram.umd.js"></script>
