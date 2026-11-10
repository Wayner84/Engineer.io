# Engineer.io — V1 Product Specification

## Product vision
Engineer.io is a browser-based factory-building and engineering progression game inspired by automation games, focused on manufacturing quality rather than combat. The player begins with hand tools and manual machines, mines and processes raw materials, builds production lines, improves process capability, inspects parts, and progresses through CNC machining, metrology, robotics, and lights-out manufacturing.

## V1 acceptance criteria
- Runs entirely in a modern desktop browser and deploys as a static GitHub Pages site.
- Playable factory grid with pan/zoom, placement, demolition, selection, rotation, pause, speed control, and a guided onboarding flow.
- Resource chain beginning with iron ore, copper ore, coal, stone, and crude oil.
- Machines include manual mining, powered drills, furnaces, manual lathe/mill, conveyors, inserters, storage, assembly, CNC lathe/mill, heat treatment, surface finishing, inspection bench, CMM, laboratory, robotics, and shipping.
- Recipes cover raw stock, castings, machined parts, fasteners, motors, sensors, control units, gearboxes, pumps, precision assemblies, and finished products.
- Quality system with material grades, dimensional quality, process capability, scrap/rework, inspection sampling, calibration, and quality gates.
- Upgrade/research tree spanning Workshop, Production, Quality, Automation, and Materials.
- Contracts/orders with quantity, quality, deadline, reward, and reputation progression.
- Economy with credits, power, maintenance, throughput, inventory, and factory KPIs.
- Campaign progression from garage workshop to smart factory, plus sandbox mode.
- Local save/load, autosave, export/import save, settings, help, and reset.
- Responsive UI suitable for desktop and usable on tablets; keyboard shortcuts and accessible controls.
- Original visuals and audio-free-by-default presentation; no copyrighted Factorio assets or branding.

## Core loop
1. Extract or purchase raw material.
2. Refine it into progressively higher-grade stock.
3. Route stock through manufacturing operations.
4. Inspect outputs and control quality.
5. Fulfil contracts to earn credits and reputation.
6. Research improved machines, process controls, and factory automation.
7. Redesign bottlenecks and pursue higher throughput, yield, and precision.

## Quality model
Each produced item carries a quality score and grade. Machine capability, operator/process upgrades, input grade, maintenance, and inspection strategy affect outcomes. Contracts specify a minimum grade. Inspection consumes time but catches defects before shipment. CMM and SPC upgrades increase confidence and enable high-value precision contracts.

## Technical constraints
- TypeScript, Vite, HTML5 Canvas/DOM UI.
- Deterministic tick-based simulation separated from rendering.
- No backend, accounts, trackers, paid APIs, or secrets.
- localStorage persistence with versioned save schema.
- Unit tests for simulation, recipes, progression, quality, and persistence.
- GitHub Actions CI and Pages deployment using relative/base-aware paths.
