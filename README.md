# Engineer.io

A browser-based engineering factory game about manufacturing, automation, metrology, and quality.

The project starts with manual machines and develops through CNC, CMM inspection, robotics, process capability, and smart-factory automation.

Engineer.io is a precision manufacturing browser game. Start in a garage workshop, extract ore, refine stock, machine parts, inspect quality, and fulfill contracts while researching automation and metrology.

## Run locally

```bash
npm install
npm run dev
```

Validation: `npm test`, `npm run typecheck`, `npm run build`.

## Controls

- **Select / Rotate**: click an installed machine to rotate it.
- **Demolish**: recover half the machine cost.
- **Building buttons**: choose a machine, then click a grid cell to place it.
- **Pause / Speed**: stop the deterministic simulation or cycle 1×–3×.
- **Zoom**: adjust the floor view for tablet-sized screens.

The game autosaves to local storage. Reset Sim starts a fresh campaign. Factory, Research, Contracts, and Field Guide tabs expose the V1 loop without a server or account.

See `docs/PRODUCT_SPEC.md` for the V1 scope.
