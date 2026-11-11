export type Tool = 'select' | 'place' | 'demolish';
export type BuildingKind =
  | 'drill'
  | 'furnace'
  | 'lathe'
  | 'conveyor'
  | 'storage'
  | 'assembler'
  | 'cmm'
  | 'shipping';
export type Item =
  | 'ironOre'
  | 'copperOre'
  | 'coal'
  | 'stone'
  | 'steel'
  | 'copper'
  | 'shaft'
  | 'gear'
  | 'precisionAssembly';

export interface Tile {
  kind?: BuildingKind;
  rot: number;
  item?: Item;
  amount?: number;
  cargo?: { item: Item; quality: number; progress: number };
}

export interface Contract {
  id: string;
  item: Item;
  qty: number;
  minGrade: number;
  reward: number;
  deadline: number;
  done: boolean;
  requiredResearch?: string;
  minReputation?: number;
}

export interface GameState {
  tick: number;
  credits: number;
  power: number;
  reputation: number;
  research: string[];
  grid: Tile[][];
  inventory: Record<string, number>;
  contracts: Contract[];
  paused: boolean;
  speed: number;
  selected: BuildingKind | null;
  mode: Tool;
  tutorial: number;
  quality: number;
}


export interface ResearchNode { id: string; label: string; cost: number; prerequisites: string[]; description: string; effects: string[]; unlocks?: BuildingKind[]; }
export type ResearchResult = { ok: true; state: GameState } | { ok: false; reason: 'unknown' | 'already-unlocked' | 'insufficient-credits' | 'prerequisite' };
export const RESEARCH_COST = 300;
export const RESEARCH: Record<string, ResearchNode> = {
  workshop:{id:'workshop',label:'Workshop Foundations',cost:150,prerequisites:[],description:'Starter fabrication.',effects:['Unlocks drills, furnaces, lathes, belts and racks.'],unlocks:['drill','furnace','lathe','conveyor','storage']},
  smelting:{id:'smelting',label:'Controlled Smelting',cost:220,prerequisites:['workshop'],description:'Stable thermal processing.',effects:['Furnaces refine steel and copper.']},
  copper:{id:'copper',label:'Copper Processing',cost:260,prerequisites:['smelting'],description:'Conductive material refining.',effects:['Copper output recipe enabled.']},
  machining:{id:'machining',label:'Machining',cost:300,prerequisites:['smelting'],description:'Repeatable shaft manufacture.',effects:['Lathes produce shafts.']},
  gearing:{id:'gearing',label:'Gear Cutting',cost:360,prerequisites:['machining'],description:'Cut steel into gears.',effects:['Lathes produce gears.']},
  assembly:{id:'assembly',label:'Precision Assembly',cost:480,prerequisites:['gearing'],description:'Combine gears and copper.',effects:['Assemblers produce precision assemblies.'],unlocks:['assembler']},
  quality:{id:'quality',label:'Quality Control',cost:300,prerequisites:['workshop'],description:'Improve process consistency.',effects:['Machining raises quality by 2%.']},
  metrology:{id:'metrology',label:'Metrology',cost:520,prerequisites:['quality'],description:'Certified inspection.',effects:['CMM benches and a 100% quality cap.'],unlocks:['cmm']},
  belts:{id:'belts',label:'High-Speed Belts',cost:340,prerequisites:['workshop'],description:'Improved logistics.',effects:['Cargo advances faster on belts.']},
  automation:{id:'automation',label:'Automation',cost:600,prerequisites:['belts','assembly'],description:'Powered production cells.',effects:['Machines gain a second production cycle every other tick.','Advanced production contracts activate.']},
  logistics:{id:'logistics',label:'Dock Logistics',cost:420,prerequisites:['belts'],description:'Reliable loading and dispatch.',effects:['Each docked cargo crate earns 1 reputation.']},
  advancedMaterials:{id:'advancedMaterials',label:'Advanced Materials',cost:700,prerequisites:['copper','metrology'],description:'Premium specifications.',effects:['High-grade contracts activate.']},
};
export const RESEARCH_IDS = Object.keys(RESEARCH) as (keyof typeof RESEARCH)[];
export function unlockResearch(s: GameState, id: string): ResearchResult {
  if (!(RESEARCH_IDS as readonly string[]).includes(id)) return { ok: false, reason: 'unknown' };
  if (s.research.includes(id)) return { ok: false, reason: 'already-unlocked' };
  const node = (RESEARCH as any)[id];
  if (node && !node.prerequisites.every((p: string) => s.research.includes(p))) return { ok: false, reason: 'prerequisite' };
  if (s.credits < (node?.cost ?? RESEARCH_COST)) return { ok: false, reason: 'insufficient-credits' };
  const next = structuredClone(s); next.credits -= node?.cost ?? RESEARCH_COST; next.research.push(id); return { ok: true, state: next };
}
export interface CampaignObjective { id: string; title: string; instructions: string; current: number; target: number; complete: boolean; }
export function campaignProgress(s: GameState): { objective: CampaignObjective; contract: Contract | undefined; researchAction: string } {
  const has = (kind: BuildingKind) => s.grid.some(row => row.some(t => t.kind === kind));
  const hasIronDrill = s.grid.some(row => row.some(t => t.kind === 'drill' && t.item === 'ironOre'));
  const hasCoalDrill = s.grid.some(row => row.some(t => t.kind === 'drill' && t.item === 'coal'));
  const c101 = s.contracts.find(c => c.id === 'C-101'); const c202 = s.contracts.find(c => c.id === 'C-202');
  const stages: CampaignObjective[] = [
    { id:'drill', title:'Place an iron drill', instructions:'Place a Powered Drill on the iron deposit.', current:hasIronDrill ? 1 : 0, target:1, complete:hasIronDrill },
    { id:'furnace', title:'Place a furnace', instructions:'Place an Arc Furnace anywhere on the floor.', current:has('furnace') ? 1 : 0, target:1, complete:has('furnace') },
    { id:'steel', title:'Ship C-101 steel', instructions:'Produce and ship 8 steel at 65% quality.', current:c101?.done ? 8 : Math.min(8, s.inventory.steel || 0), target:8, complete:!!c101?.done },
    { id:'quality', title:'Unlock Quality', instructions:'Buy the Quality research node for ₡300.', current:s.research.includes('quality') ? 1 : 0, target:1, complete:s.research.includes('quality') },
    { id:'coal', title:'Secure a coal supply', instructions:'Place a Powered Drill on the nearby CO coal deposit.', current:hasCoalDrill ? 1 : 0, target:1, complete:hasCoalDrill },
    { id:'lathe', title:'Reach 78% quality', instructions:'Place a Manual Lathe and produce shafts.', current:has('lathe') ? Math.min(78, s.quality) : 0, target:78, complete:has('lathe') && s.quality >= 78 },
    { id:'shafts', title:'Ship C-202 shafts', instructions:'Produce and ship 4 shafts at 78% quality.', current:c202?.done ? 4 : Math.min(4, s.inventory.shaft || 0), target:4, complete:!!c202?.done },
  ];
  const objective = stages.find(x => !x.complete) || { id:'complete', title:'Campaign complete', instructions:'Both starter contracts shipped.', current:1, target:1, complete:true };
  return { objective, contract: objective.id === 'steel' ? c101 : objective.id === 'shafts' ? c202 : undefined, researchAction: objective.id === 'quality' ? 'QUALITY · ₡300' : 'No research required now' };
}

export const GRID_WIDTH = 30;
export const GRID_HEIGHT = 18;
export type BeltDirection = 'east' | 'south' | 'west' | 'north';
export function beltDirection(rot: number): BeltDirection { return (['east', 'south', 'west', 'north'] as const)[((rot % 4) + 4) % 4]; }
const LEGACY_GRID_WIDTH = 18;
const LEGACY_GRID_HEIGHT = 12;
const TOOLS: Tool[] = ['select', 'place', 'demolish'];
const BUILDING_KINDS: BuildingKind[] = ['drill', 'furnace', 'lathe', 'conveyor', 'storage', 'assembler', 'cmm', 'shipping'];
const ITEMS: Item[] = ['ironOre', 'copperOre', 'coal', 'stone', 'steel', 'copper', 'shaft', 'gear', 'precisionAssembly'];
function dispatchEligible(s: GameState): void {
  for (const contract of s.contracts) {
    if (contract.done || s.tick >= contract.deadline) continue;
    if (contract.requiredResearch && !s.research.includes(contract.requiredResearch)) continue;
    if ((s.inventory[contract.item] || 0) >= contract.qty && s.quality >= contract.minGrade) {
      fulfillContract(s, contract.id);
      return;
    }
  }
}
const LEGACY_DEPOSITS = [
  [2, 2, 'ironOre'],
  [4, 8, 'copperOre'],
  [14, 3, 'coal'],
  [13, 9, 'stone'],
] as const satisfies readonly (readonly [number, number, Item])[];
const DEPOSITS = [
  ...LEGACY_DEPOSITS,
  [6, 2, 'ironOre'],
  [20, 8, 'copperOre'],
  [5, 4, 'coal'],
  [24, 14, 'stone'],
] as const satisfies readonly (readonly [number, number, Item])[];

export const BUILDINGS: Record<BuildingKind, { label: string; cost: number; power: number; color: string; requiredResearch: string }> = {
  drill: { label: 'Powered Drill', cost: 120, power: 3, color: '#e8ad4b', requiredResearch:'workshop' },
  furnace: { label: 'Arc Furnace', cost: 180, power: 5, color: '#e66a46', requiredResearch:'workshop' },
  lathe: { label: 'Manual Lathe', cost: 80, power: 0, color: '#4db5d9', requiredResearch:'workshop' },
  conveyor: { label: 'Belt', cost: 25, power: 1, color: '#8193a6', requiredResearch:'workshop' },
  storage: { label: 'Stock Rack', cost: 60, power: 0, color: '#7d9a71', requiredResearch:'workshop' },
  assembler: { label: 'Assembler', cost: 300, power: 8, color: '#af77d8', requiredResearch:'assembly' },
  cmm: { label: 'CMM Bench', cost: 450, power: 4, color: '#63d7ad', requiredResearch:'metrology' },
  shipping: { label: 'Shipping Dock', cost: 220, power: 1, color: '#f0cf6b', requiredResearch:'workshop' },
};

const CONTRACT_TEMPLATES: Contract[] = [
  { id: 'C-101', item: 'steel', qty: 8, minGrade: 65, reward: 480, deadline: 900, done: false },
  { id: 'C-202', item: 'shaft', qty: 4, minGrade: 78, reward: 720, deadline: 1400, done: false },
  { id: 'C-303', item: 'copper', qty: 6, minGrade: 70, reward: 520, deadline: 1800, done: false, requiredResearch: 'copper', minReputation: 10 },
  { id: 'C-404', item: 'gear', qty: 3, minGrade: 75, reward: 900, deadline: 2400, done: false, requiredResearch: 'gearing', minReputation: 20 },
  { id: 'C-505', item: 'precisionAssembly', qty: 2, minGrade: 82, reward: 1400, deadline: 3200, done: false, requiredResearch: 'assembly', minReputation: 30 },
  { id: 'C-606', item: 'steel', qty: 16, minGrade: 80, reward: 1100, deadline: 3600, done: false, requiredResearch: 'advancedMaterials', minReputation: 40 },
  { id: 'C-707', item: 'shaft', qty: 8, minGrade: 85, reward: 1500, deadline: 4200, done: false, requiredResearch: 'automation', minReputation: 50 },
  { id: 'C-808', item: 'copper', qty: 12, minGrade: 85, reward: 1200, deadline: 4800, done: false, requiredResearch: 'advancedMaterials', minReputation: 60 },
];

export function newGame(): GameState {
  const grid: Tile[][] = Array.from({ length: GRID_HEIGHT }, () => Array.from({ length: GRID_WIDTH }, () => ({ rot: 0 })));
  for (const [x, y, item] of DEPOSITS) grid[y][x] = { rot: 0, item, amount: 999 };
  return {
    tick: 0,
    credits: 1200,
    power: 30,
    reputation: 0,
    research: ['workshop'],
    grid,
    inventory: { ironOre: 12, copperOre: 8, coal: 10, stone: 10 },
    contracts: structuredClone(CONTRACT_TEMPLATES),
    paused: false,
    speed: 1,
    selected: null,
    mode: 'select',
    tutorial: 0,
    quality: 72,
  };
}

export function place(s: GameState, x: number, y: number, kind: BuildingKind): boolean {
  const tile = s.grid[y]?.[x];
  const building = BUILDINGS[kind];
  if (!tile || tile.kind || s.credits < building.cost || !s.research.includes(building.requiredResearch) || (kind === 'drill' && !tile.item)) return false;
  tile.kind = kind;
  s.credits -= building.cost;
  return true;
}

export function rotate(s: GameState, x: number, y: number): void {
  const tile = s.grid[y]?.[x];
  if (tile?.kind) tile.rot = (tile.rot + 1) % 4;
}

export function demolish(s: GameState, x: number, y: number): boolean {
  const tile = s.grid[y]?.[x];
  if (!tile?.kind) return false;
  s.credits += Math.floor(BUILDINGS[tile.kind].cost * 0.5);
  if (tile.cargo) {
    s.inventory[tile.cargo.item] = (s.inventory[tile.cargo.item] || 0) + 1;
    delete tile.cargo;
  }
  tile.kind = undefined;
  tile.rot = 0;
  return true;
}

const DIRECTION_DELTAS: Record<BeltDirection, readonly [number, number]> = {
  east: [1, 0], south: [0, 1], west: [-1, 0], north: [0, -1],
};

function adjacentTile(s: GameState, x: number, y: number, rot: number): Tile | undefined {
  const [dx, dy] = DIRECTION_DELTAS[beltDirection(rot)];
  return s.grid[y + dy]?.[x + dx];
}

function outputItem(s: GameState, x: number, y: number, item: Item): void {
  const machine = s.grid[y][x];
  const target = adjacentTile(s, x, y, machine.rot);
  if (target?.kind === 'conveyor' && !target.cargo) {
    target.cargo = { item, quality: s.quality, progress: 0 };
  } else {
    s.inventory[item] = (s.inventory[item] || 0) + 1;
  }
}

function activeContractFor(s: GameState, items: Item[]): Contract | undefined {
  return s.contracts.find((contract) => !contract.done
    && s.tick < contract.deadline
    && items.includes(contract.item)
    && (!contract.requiredResearch || s.research.includes(contract.requiredResearch))
    && (!contract.minReputation || s.reputation >= contract.minReputation));
}

function advanceCargo(s: GameState): void {
  const speed = s.research.includes('belts') ? 0.67 : 0.34;
  const occupiedAtStart: Array<{ x: number; y: number; cargo: NonNullable<Tile['cargo']> }> = [];
  for (let y = 0; y < GRID_HEIGHT; y++) for (let x = 0; x < GRID_WIDTH; x++) {
    const cargo = s.grid[y][x].cargo;
    if (cargo) occupiedAtStart.push({ x, y, cargo: { ...cargo } });
  }
  const reserved = new Set<string>();
  for (const entry of occupiedAtStart) {
    const source = s.grid[entry.y][entry.x];
    if (!source.cargo) continue;
    source.cargo.progress = Math.min(1, entry.cargo.progress + speed);
    if (source.cargo.progress < 1) continue;
    const [dx, dy] = DIRECTION_DELTAS[beltDirection(source.rot)];
    const targetX = entry.x + dx; const targetY = entry.y + dy;
    const target = s.grid[targetY]?.[targetX];
    const targetKey = `${targetX},${targetY}`;
    if (target?.kind === 'conveyor' && !target.cargo && !reserved.has(targetKey)) {
      target.cargo = { ...source.cargo, progress: 0 };
      delete source.cargo;
      reserved.add(targetKey);
      continue;
    }
    if (target?.kind === 'storage' || target?.kind === 'shipping') {
      const item = source.cargo.item;
      s.inventory[item] = (s.inventory[item] || 0) + 1;
      delete source.cargo;
      if (target.kind === 'shipping') {
        if (s.research.includes('logistics')) s.reputation += 1;
        dispatchEligible(s);
      }
      continue;
    }
    source.cargo.progress = 1;
  }
}

function processMachines(s: GameState): number {
  let powerUsed = 0;
  const furnaces = s.grid.flat().filter((tile) => tile.kind === 'furnace').length;
  let furnaceIndex = 0;
  for (let y = 0; y < GRID_HEIGHT; y++) for (let x = 0; x < GRID_WIDTH; x++) {
    const tile = s.grid[y][x];
    if (tile.kind) powerUsed += BUILDINGS[tile.kind].power;
    if (tile.kind === 'drill' && tile.item && (tile.amount ?? 0) > 0) {
      tile.amount!--;
      outputItem(s, x, y, tile.item);
    } else if (tile.kind === 'furnace') {
      const requested = activeContractFor(s, ['steel', 'copper'])?.item;
      const makeCopper = (furnaces > 1 && furnaceIndex++ % 2 === 1) || requested === 'copper';
      if (makeCopper && (s.inventory.copperOre || 0) >= 1 && (s.inventory.coal || 0) >= 1) {
        s.inventory.copperOre--; s.inventory.coal--; outputItem(s, x, y, 'copper');
      } else if ((s.inventory.ironOre || 0) >= 2 && (s.inventory.coal || 0) >= 1) {
        s.inventory.ironOre -= 2; s.inventory.coal--; outputItem(s, x, y, 'steel');
      } else if ((s.inventory.copperOre || 0) >= 1 && (s.inventory.coal || 0) >= 1) {
        s.inventory.copperOre--; s.inventory.coal--; outputItem(s, x, y, 'copper');
      }
    } else if (tile.kind === 'lathe' && (s.inventory.steel || 0) >= 1) {
      const requested = activeContractFor(s, ['shaft', 'gear']);
      const item: Item = requested?.item === 'gear' && s.research.includes('gearing') ? 'gear' : 'shaft';
      s.inventory.steel--;
      outputItem(s, x, y, item);
      if (s.research.includes('quality')) s.quality = Math.min(s.research.includes('metrology') ? 100 : 98, s.quality + 2);
    } else if (tile.kind === 'assembler' && (s.inventory.gear || 0) >= 1 && (s.inventory.copper || 0) >= 1) {
      s.inventory.gear--; s.inventory.copper--;
      outputItem(s, x, y, 'precisionAssembly');
    } else if (tile.kind === 'cmm' && s.research.includes('metrology')) {
      s.quality = Math.min(100, s.quality + 0.25);
    }
  }
  return powerUsed;
}

export function tick(s: GameState, steps = 1): void {
  if (s.paused) return;
  for (let i = 0; i < steps; i++) {
    s.tick++;
    advanceCargo(s);
    const powerUsed = processMachines(s);
    if (s.research.includes('automation') && s.tick % 2 === 0) processMachines(s);
    s.power = Math.max(0, 30 - powerUsed);
  }
}

export type FulfillResult = { ok: true } | { ok: false; reason: 'missing' | 'done' | 'stock' | 'quality' | 'expired' | 'locked' };

export function fulfillContract(s: GameState, id: string): FulfillResult {
  const contract = s.contracts.find((candidate) => candidate.id === id);
  if (!contract) return { ok: false, reason: 'missing' };
  if (contract.done) return { ok: false, reason: 'done' };
  if ((contract.requiredResearch && !s.research.includes(contract.requiredResearch))
    || (contract.minReputation !== undefined && s.reputation < contract.minReputation)) return { ok: false, reason: 'locked' };
  if (s.tick >= contract.deadline) return { ok: false, reason: 'expired' };
  if ((s.inventory[contract.item] || 0) < contract.qty) return { ok: false, reason: 'stock' };
  if (s.quality < contract.minGrade) return { ok: false, reason: 'quality' };
  s.inventory[contract.item] -= contract.qty;
  s.credits += contract.reward;
  s.reputation += 10;
  contract.done = true;
  return { ok: true };
}

export function save(s: GameState): string {
  return JSON.stringify({ ...s, version: 4 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isIntegerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && (value as number) >= minimum && (value as number) <= maximum;
}

function mergeContractTemplates(value: unknown): Contract[] {
  const existing = Array.isArray(value) ? value.filter(isRecord) : [];
  return CONTRACT_TEMPLATES.map((template) => {
    const saved = existing.find((contract) => contract.id === template.id);
    return saved ? { ...template, ...saved } as Contract : structuredClone(template);
  });
}

function migrateLegacy(data: Record<string, unknown>): void {
  if ((data.version !== 1 && data.version !== 2 && data.version !== 3) || !Array.isArray(data.grid)) return;
  if (data.version === 3 && data.grid.length === GRID_HEIGHT) {
    data.contracts = mergeContractTemplates(data.contracts);
    data.version = 4;
    return;
  }
  const oldGrid = data.grid;
  if (oldGrid.length !== LEGACY_GRID_HEIGHT || !oldGrid.every(row => Array.isArray(row) && row.length === LEGACY_GRID_WIDTH)) return;
  const occupiedLegacyCells = new Set<string>();
  for (let y = 0; y < oldGrid.length; y++) for (let x = 0; x < oldGrid[y].length; x++) {
    const tile = oldGrid[y][x];
    if (isRecord(tile) && (tile.kind !== undefined || tile.item !== undefined)) occupiedLegacyCells.add(`${x},${y}`);
  }
  if (data.version === 1) {
    for (const [x, y, item] of LEGACY_DEPOSITS) {
      const row = oldGrid[y]; const tile = Array.isArray(row) ? row[x] : undefined;
      if (isRecord(tile)) { if (tile.item === undefined) tile.item = item; if (tile.amount === undefined) tile.amount = 999; }
    }
    for (const row of oldGrid) for (const tile of row) {
      if (!isRecord(tile) || tile.kind !== 'drill' || tile.item !== undefined) continue;
      delete tile.kind; tile.rot = 0;
      if (typeof data.credits === 'number') data.credits += BUILDINGS.drill.cost;
    }
  }
  data.grid = Array.from({ length: GRID_HEIGHT }, (_, y) => Array.from({ length: GRID_WIDTH }, (_, x) => {
    const oldTile = y < LEGACY_GRID_HEIGHT && x < LEGACY_GRID_WIDTH ? oldGrid[y][x] : undefined;
    return isRecord(oldTile) ? oldTile : { rot: 0 };
  }));
  for (const [x, y, item] of DEPOSITS) {
    const tile = (data.grid as unknown[][])[y][x];
    const isLegacyDeposit = LEGACY_DEPOSITS.some(([legacyX, legacyY]) => legacyX === x && legacyY === y);
    if (!isLegacyDeposit && occupiedLegacyCells.has(`${x},${y}`)) continue;
    if (isRecord(tile) && tile.kind === undefined && tile.item === undefined) Object.assign(tile, { item, amount: 999 });
  }
  data.contracts = mergeContractTemplates(data.contracts);
  data.version = 4;
}

function isTile(value: unknown): value is Tile {
  if (isRecord(value) && value.cargo !== undefined && (value.kind !== 'conveyor' || !isRecord(value.cargo) || !ITEMS.includes(value.cargo.item as Item) || !isFiniteNonNegative(value.cargo.quality) || (value.cargo.quality as number) > 100 || !isFiniteNonNegative(value.cargo.progress) || (value.cargo.progress as number) > 1)) return false;
  if (!isRecord(value) || !isIntegerInRange(value.rot, 0, 3)) return false;
  if (value.kind !== undefined && !BUILDING_KINDS.includes(value.kind as BuildingKind)) return false;
  if (value.item !== undefined && !ITEMS.includes(value.item as Item)) return false;
  if (value.amount !== undefined && (!isFiniteNonNegative(value.amount) || !Number.isInteger(value.amount))) return false;
  if (value.item !== undefined && value.amount === undefined) return false;
  if (value.kind === 'drill' && value.item === undefined) return false;
  return true;
}

function isContract(value: unknown): value is Contract {
  return isRecord(value)
    && typeof value.id === 'string'
    && value.id.length > 0
    && ITEMS.includes(value.item as Item)
    && Number.isInteger(value.qty)
    && (value.qty as number) > 0
    && isFiniteNonNegative(value.minGrade)
    && (value.minGrade as number) <= 100
    && isFiniteNonNegative(value.reward)
    && Number.isInteger(value.deadline)
    && (value.deadline as number) >= 0
    && typeof value.done === 'boolean'
    && (value.requiredResearch === undefined || (typeof value.requiredResearch === 'string' && RESEARCH_IDS.includes(value.requiredResearch)))
    && (value.minReputation === undefined || isFiniteNonNegative(value.minReputation));
}

function isInventory(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNonNegative);
}

function isGameState(value: unknown): value is GameState & { version: 4 } {
  if (!isRecord(value) || value.version !== 4) return false;
  if (!Number.isInteger(value.tick) || (value.tick as number) < 0) return false;
  if (!isFiniteNonNegative(value.credits) || !isFiniteNonNegative(value.power) || !isFiniteNonNegative(value.reputation)) return false;
  if (!isFiniteNonNegative(value.tutorial) || !isFiniteNonNegative(value.quality) || (value.quality as number) > 100) return false;
  if (!Array.isArray(value.research) || !value.research.every((entry) => typeof entry === 'string' && RESEARCH_IDS.includes(entry))) return false;
  if (!Array.isArray(value.grid) || value.grid.length !== GRID_HEIGHT) return false;
  if (!value.grid.every((row) => Array.isArray(row) && row.length === GRID_WIDTH && row.every(isTile))) return false;
  if (!isInventory(value.inventory)) return false;
  if (!Array.isArray(value.contracts) || !value.contracts.every(isContract)) return false;
  if (typeof value.paused !== 'boolean' || ![1, 2, 3].includes(value.speed as number)) return false;
  if (value.selected !== null && !BUILDING_KINDS.includes(value.selected as BuildingKind)) return false;
  if (!TOOLS.includes(value.mode as Tool)) return false;
  return true;
}

export function load(raw: string): GameState {
  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed)) migrateLegacy(parsed);
  if (!isGameState(parsed)) throw new Error('Invalid or unsupported save');
  const { version: _version, ...state } = parsed;
  return state;
}
