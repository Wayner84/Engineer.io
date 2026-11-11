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
}

export interface Contract {
  id: string;
  item: Item;
  qty: number;
  minGrade: number;
  reward: number;
  deadline: number;
  done: boolean;
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


export type ResearchResult = { ok: true; state: GameState } | { ok: false; reason: 'unknown' | 'already-unlocked' | 'insufficient-credits' };
export const RESEARCH_COST = 300;
export const RESEARCH_IDS = ['workshop', 'production', 'quality', 'automation', 'materials'] as const;
export function unlockResearch(s: GameState, id: string): ResearchResult {
  if (!(RESEARCH_IDS as readonly string[]).includes(id)) return { ok: false, reason: 'unknown' };
  if (s.research.includes(id)) return { ok: false, reason: 'already-unlocked' };
  if (s.credits < RESEARCH_COST) return { ok: false, reason: 'insufficient-credits' };
  const next = structuredClone(s); next.credits -= RESEARCH_COST; next.research.push(id); return { ok: true, state: next };
}
export interface CampaignObjective { id: string; title: string; instructions: string; current: number; target: number; complete: boolean; }
export function campaignProgress(s: GameState): { objective: CampaignObjective; contract: Contract | undefined; researchAction: string } {
  const has = (kind: BuildingKind) => s.grid.some(row => row.some(t => t.kind === kind));
  const hasIronDrill = s.grid.some(row => row.some(t => t.kind === 'drill' && t.item === 'ironOre'));
  const c101 = s.contracts.find(c => c.id === 'C-101'); const c202 = s.contracts.find(c => c.id === 'C-202');
  const stages: CampaignObjective[] = [
    { id:'drill', title:'Place an iron drill', instructions:'Place a Powered Drill on the iron deposit.', current:hasIronDrill ? 1 : 0, target:1, complete:hasIronDrill },
    { id:'furnace', title:'Place a furnace', instructions:'Place an Arc Furnace anywhere on the floor.', current:has('furnace') ? 1 : 0, target:1, complete:has('furnace') },
    { id:'steel', title:'Ship C-101 steel', instructions:'Produce and ship 8 steel at 65% quality.', current:c101?.done ? 8 : Math.min(8, s.inventory.steel || 0), target:8, complete:!!c101?.done },
    { id:'quality', title:'Unlock Quality', instructions:'Buy the Quality research node for ₡300.', current:s.research.includes('quality') ? 1 : 0, target:1, complete:s.research.includes('quality') },
    { id:'lathe', title:'Reach 78% quality', instructions:'Place a Manual Lathe and produce shafts.', current:has('lathe') ? Math.min(78, s.quality) : 0, target:78, complete:has('lathe') && s.quality >= 78 },
    { id:'shafts', title:'Ship C-202 shafts', instructions:'Produce and ship 4 shafts at 78% quality.', current:c202?.done ? 4 : Math.min(4, s.inventory.shaft || 0), target:4, complete:!!c202?.done },
  ];
  const objective = stages.find(x => !x.complete) || { id:'complete', title:'Campaign complete', instructions:'Both starter contracts shipped.', current:1, target:1, complete:true };
  return { objective, contract: objective.id === 'steel' ? c101 : objective.id === 'shafts' ? c202 : undefined, researchAction: objective.id === 'quality' ? 'QUALITY · ₡300' : 'No research required now' };
}

const W = 18;
const H = 12;
const TOOLS: Tool[] = ['select', 'place', 'demolish'];
const BUILDING_KINDS: BuildingKind[] = ['drill', 'furnace', 'lathe', 'conveyor', 'storage', 'assembler', 'cmm', 'shipping'];
const ITEMS: Item[] = ['ironOre', 'copperOre', 'coal', 'stone', 'steel', 'copper', 'shaft', 'gear', 'precisionAssembly'];
const DEPOSITS = [
  [2, 2, 'ironOre'],
  [4, 8, 'copperOre'],
  [14, 3, 'coal'],
  [13, 9, 'stone'],
] as const satisfies readonly (readonly [number, number, Item])[];

export const BUILDINGS: Record<BuildingKind, { label: string; cost: number; power: number; color: string }> = {
  drill: { label: 'Powered Drill', cost: 120, power: 3, color: '#e8ad4b' },
  furnace: { label: 'Arc Furnace', cost: 180, power: 5, color: '#e66a46' },
  lathe: { label: 'Manual Lathe', cost: 80, power: 0, color: '#4db5d9' },
  conveyor: { label: 'Belt', cost: 25, power: 1, color: '#8193a6' },
  storage: { label: 'Stock Rack', cost: 60, power: 0, color: '#7d9a71' },
  assembler: { label: 'Assembler', cost: 300, power: 8, color: '#af77d8' },
  cmm: { label: 'CMM Bench', cost: 450, power: 4, color: '#63d7ad' },
  shipping: { label: 'Shipping Dock', cost: 220, power: 1, color: '#f0cf6b' },
};

export function newGame(): GameState {
  const grid: Tile[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => ({ rot: 0 })));
  for (const [x, y, item] of DEPOSITS) grid[y][x] = { rot: 0, item, amount: 999 };
  return {
    tick: 0,
    credits: 1200,
    power: 30,
    reputation: 0,
    research: ['workshop'],
    grid,
    inventory: { ironOre: 12, copperOre: 8, coal: 10, stone: 10 },
    contracts: [
      { id: 'C-101', item: 'steel', qty: 8, minGrade: 65, reward: 480, deadline: 900, done: false },
      { id: 'C-202', item: 'shaft', qty: 4, minGrade: 78, reward: 720, deadline: 1400, done: false },
    ],
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
  if (!tile || tile.kind || s.credits < building.cost || (kind === 'drill' && !tile.item)) return false;
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
  tile.kind = undefined;
  tile.rot = 0;
  return true;
}

export function tick(s: GameState, steps = 1): void {
  if (s.paused) return;
  for (let i = 0; i < steps; i++) {
    s.tick++;
    let furnaces = 0;
    let lathes = 0;
    let assemblers = 0;
    let powerUsed = 0;

    for (const row of s.grid) {
      for (const tile of row) {
        if (tile.kind) powerUsed += BUILDINGS[tile.kind].power;
        if (tile.kind === 'drill') {
          if (tile.item && (tile.amount ?? 0) > 0) {
            s.inventory[tile.item] = (s.inventory[tile.item] || 0) + 1;
            tile.amount!--;
          }
        }
        if (tile.kind === 'furnace') furnaces++;
        if (tile.kind === 'lathe') lathes++;
        if (tile.kind === 'assembler') assemblers++;
      }
    }

    const steel = Math.min(Math.ceil(furnaces / 2), Math.floor((s.inventory.ironOre || 0) / 2), s.inventory.coal || 0);
    s.inventory.ironOre = (s.inventory.ironOre || 0) - steel * 2;
    s.inventory.coal = (s.inventory.coal || 0) - steel;
    s.inventory.steel = (s.inventory.steel || 0) + steel;

    const copper = Math.min(furnaces - steel, s.inventory.copperOre || 0, s.inventory.coal || 0);
    s.inventory.copperOre = (s.inventory.copperOre || 0) - copper;
    s.inventory.coal = (s.inventory.coal || 0) - copper;
    s.inventory.copper = (s.inventory.copper || 0) + copper;

    if (lathes && (s.inventory.steel || 0) >= 1) {
      const produced = Math.min(lathes, s.inventory.steel);
      s.inventory.steel -= produced;
      s.inventory.shaft = (s.inventory.shaft || 0) + produced;
      if (s.research.includes('quality')) s.quality = Math.min(98, s.quality + produced);
    }

    if (assemblers && (s.inventory.shaft || 0) >= 2 && (s.inventory.copper || 0) >= 1) {
      const produced = Math.min(assemblers, Math.floor(s.inventory.shaft / 2), s.inventory.copper);
      s.inventory.shaft -= produced * 2;
      s.inventory.copper -= produced;
      s.inventory.precisionAssembly = (s.inventory.precisionAssembly || 0) + produced;
    }

    s.power = Math.max(0, 30 - powerUsed);
  }
}

export type FulfillResult = { ok: true } | { ok: false; reason: 'missing' | 'done' | 'stock' | 'quality' | 'expired' };

export function fulfillContract(s: GameState, id: string): FulfillResult {
  const contract = s.contracts.find((candidate) => candidate.id === id);
  if (!contract) return { ok: false, reason: 'missing' };
  if (contract.done) return { ok: false, reason: 'done' };
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
  return JSON.stringify({ ...s, version: 2 });
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

function migrateVersionOne(data: Record<string, unknown>): void {
  if (data.version !== 1 || !Array.isArray(data.grid)) return;
  for (const [x, y, item] of DEPOSITS) {
    const row = data.grid[y];
    if (!Array.isArray(row)) continue;
    const tile = row[x];
    if (!isRecord(tile)) continue;
    if (tile.item === undefined) tile.item = item;
    if (tile.amount === undefined) tile.amount = 999;
  }
  for (const row of data.grid) {
    if (!Array.isArray(row)) continue;
    for (const tile of row) {
      if (!isRecord(tile) || tile.kind !== 'drill' || tile.item !== undefined) continue;
      delete tile.kind;
      tile.rot = 0;
      if (typeof data.credits === 'number') data.credits += BUILDINGS.drill.cost;
    }
  }
}

function isTile(value: unknown): value is Tile {
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
    && typeof value.done === 'boolean';
}

function isInventory(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every(isFiniteNonNegative);
}

function isGameState(value: unknown): value is GameState & { version: 1 | 2 } {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2)) return false;
  if (!Number.isInteger(value.tick) || (value.tick as number) < 0) return false;
  if (!isFiniteNonNegative(value.credits) || !isFiniteNonNegative(value.power) || !isFiniteNonNegative(value.reputation)) return false;
  if (!isFiniteNonNegative(value.tutorial) || !isFiniteNonNegative(value.quality) || (value.quality as number) > 100) return false;
  if (!Array.isArray(value.research) || !value.research.every((entry) => typeof entry === 'string')) return false;
  if (!Array.isArray(value.grid) || value.grid.length !== H) return false;
  if (!value.grid.every((row) => Array.isArray(row) && row.length === W && row.every(isTile))) return false;
  if (!isInventory(value.inventory)) return false;
  if (!Array.isArray(value.contracts) || !value.contracts.every(isContract)) return false;
  if (typeof value.paused !== 'boolean' || ![1, 2, 3].includes(value.speed as number)) return false;
  if (value.selected !== null && !BUILDING_KINDS.includes(value.selected as BuildingKind)) return false;
  if (!TOOLS.includes(value.mode as Tool)) return false;
  return true;
}

export function load(raw: string): GameState {
  const parsed: unknown = JSON.parse(raw);
  if (isRecord(parsed)) migrateVersionOne(parsed);
  if (!isGameState(parsed)) throw new Error('Invalid or unsupported save');
  const { version: _version, ...state } = parsed;
  return state;
}
