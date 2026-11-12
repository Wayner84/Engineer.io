# Engineer.io Manufacturing Roadmap

Scope rule: this document records future systems only; the current UI/SPC batch does not implement them.

## Status and gates

- **Implemented — commerce and customer contracts:** deterministic supplier stock purchases, direct sales, customer identity catalogue, customer-tagged starter contracts, and save schema v6 migration foundation.
- **Implemented — controlled job execution:** revisioned customer blueprints, exact batch material/grade reservation, explicit assignment of turning/milling/inspection operations to compatible shop-floor machines, deterministic batch progress and finished stock, protected active reservations, and save schema v8 migration/validation.
- **Implemented — job depth:** deterministic per-unit operation quality and rejects, conservation of accepted/rejected batch quantities, grade-preserving finished stock, per-operation machine/tick/yield traceability, and save schema v9 migration/validation.
- **Future — job depth:** outsourcing; deeper supplier catalogue; rooms/HVAC and power networks.
- **Later — process families:** grinding; forging blanks; sheet-metal bending/rolling/pressing; composite/fibreglass; plastics injection moulding, extrusion and 3D printing; later raw-material production. Gate each family with bounded recipes, tooling, quality distributions, wear, routing and conservation tests.
- **Later — plant infrastructure:** staged early purchasing of stock versus late vertical integration; power/substation capacity upgrades; sealed temperature-controlled rooms with HVAC and pass-through transport for CMM and composite layup; warehousing extension. Gate: capacity is explicit, room conditions affect eligibility/quality, transport cannot bypass pass-through rules.
- **Later — consumables and upgrades:** `WaliExpress` tooling/probe tiers with budget effects on life, variation, repeatability and Cpk. Gate: consumable life is finite, replacement is auditable, cheaper tiers never silently create impossible inspection confidence.

## Core data models

- `Blueprint`: customer/product identity, revision, required grade, operations, material and inspection plan.
- `Job`: blueprint revision, selected batch quantity, customer, due date, status, reserved stock and results.
- `OperationRoute`: ordered operations, machine/process family, setup, inputs/outputs, quality and inspection requirements.
- `WorkOrder`: one executable operation instance, quantity, queue/lead time, machine, condition, rejects and traceability.
- `SupplierOffer`: deterministic supplier/product identity, tier, price, lead time, quantity and quality range.
- `OutsourceOrder`: supplier offer, operation, quantity, promised completion, received grade and inspection evidence.
- `Room/HVAC`: sealed-room class, temperature/humidity limits, HVAC capacity, pass-through endpoints and occupancy.
- `PowerNetwork`: feeds, substations, capacity, load, upgrade level and brownout policy.
- `Tooling/Probe`: type, supplier tier, life, calibration/reliability, repeatability and supported operations.

## Dependency research tree

1. **Workshop foundations:** drills → furnaces → belts → starter stock and steel sales.
2. **Manual production:** manual lathe → shafts/gears → higher-value products and assembly.
3. **Quality:** Quality → SPC Fundamentals → Metrology/inspection reliability → Process Capability.
4. **Automation:** CNC machining after manual machining and capability evidence; CNC improves repeatability, not inspection truth.
5. **Regulated sectors:** aerospace/medical certification only after reliable inspection, samples and required Cpk.
6. **Expansion:** outsourcing and supplier catalogue before buying every specialist process; rooms/HVAC, substations, tooling and warehousing follow demonstrated demand.

Each node must declare truthful prerequisites, effects, unlocks and migration impact. Research purchases remain atomic and deterministic.

## Save-migration strategy

Keep a versioned envelope and migrate one version at a time. Add optional collections as empty arrays/maps; preserve completed contracts, inventory, research, machine condition and in-flight cargo. Never seed a new deposit, job, customer, supplier, room or power asset over an occupied legacy cell. Reject malformed dimensions, negative quantities, invalid enum identities, non-finite quality/Cpk and impossible route states. Add fixtures for current valid saves, malformed saves, unsupported versions, legacy saves with occupied cells, in-flight cargo, completed contracts and partially completed work orders before tightening validation.

## Milestone acceptance pattern

Every milestone needs: public-API deterministic tests; exact stock/credits/reputation/lead-time assertions; pause and persistence coverage; migration fixtures; a browser smoke path for visibility and controls; `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check` green. Keep future systems behind bounded registries and explicit state transitions rather than implicit UI-only behavior.
