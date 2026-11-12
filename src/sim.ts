export type Tool = 'select' | 'place' | 'demolish';
export type BuildingKind =
  | 'drill'
  | 'furnace'
  | 'lathe'
  | 'mill'
  | 'cncLathe'
  | 'cncMill'
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
  | 'precisionAssembly'
  | 'machinedPlate'
  | 'bracket'
  | 'precisionHousing';

export interface Tile {
  kind?: BuildingKind;
  rot: number;
  item?: Item;
  amount?: number;
  cargo?: { item: Item; quality: number; progress: number };
  condition?: number;
  cycle?: number;
}
export interface StockQuality { quantity: number; average: number }
export interface SpcData { count: number; mean: number; m2: number; standardDeviation: number; cpk: number | null }
export interface ProductionStats { attempted: number; accepted: number; rejected: number; scrap: number }

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
  sector?: 'regular' | 'aerospace' | 'medical';
  minCpk?: number;
  minSamples?: number;
  inspectionLevel?: 'basic' | 'traceable' | 'certified';
  customer?: string;
  starter?: boolean;
  sequence?: number;
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
  stockQuality: Partial<Record<Item, StockQuality>>;
  stats: ProductionStats;
  spc: Partial<Record<Item, SpcData>>;
  commerce: { unitsBought: number; unitsSold: number; directRevenue: number; directSpend: number };
  contractSequence: number;
  schemaVersion: 6;
}

const CUSTOMER_NAMES = Array.from({ length: 1000 }, (_, i) => {
  const prefixes = ['Aster','Beacon','Cobalt','Delta','Everest','Forge','Granite','Helix','Ion','Juniper','Keystone','Lattice',' Meridian','Northstar','Orbit','Pioneer','Quantum','Redwood','Summit','Tandem'];
  const suffixes = ['Works','Dynamics','Fabrication','Industries','Systems','Machining','Aerospace','Medical','Foundry','Precision'];
  return `${prefixes[Math.floor(i / suffixes.length) % prefixes.length].trim()} ${suffixes[i % suffixes.length]} ${String(Math.floor(i / 200) + 1).padStart(2, '0')}`;
});
export function customerName(index: number): string { return CUSTOMER_NAMES[((Math.trunc(index) % CUSTOMER_NAMES.length) + CUSTOMER_NAMES.length) % CUSTOMER_NAMES.length]; }
export const CUSTOMER_CATALOGUE = [...CUSTOMER_NAMES];

export interface SupplierOffer { id: string; supplier: string; item: Item; packQty: number; price: number; grade: number }
export const SUPPLIER_OFFERS: SupplierOffer[] = [
  { id:'iron-ore', supplier:'Redwood Mineral Co.', item:'ironOre', packQty:10, price:90, grade:72 },
  { id:'copper-ore', supplier:'Cobalt Ridge Metals', item:'copperOre', packQty:10, price:120, grade:74 },
  { id:'coal', supplier:'Granite Carbon Supply', item:'coal', packQty:12, price:80, grade:70 },
  { id:'stone', supplier:'Beacon Aggregate', item:'stone', packQty:12, price:55, grade:76 },
  { id:'steel', supplier:'Aster Steel Service', item:'steel', packQty:5, price:210, grade:82 },
];
const SALE_PRICES: Partial<Record<Item, number>> = { steel:120, copper:105, shaft:180, gear:260, machinedPlate:240, bracket:320, precisionHousing:520, precisionAssembly:700 };
export type CommerceResult = { ok:true; total:number } | { ok:false; reason:'unknown-offer'|'invalid-quantity'|'insufficient-credits'|'unsaleable-item'|'insufficient-stock' };
export function buyStock(s: GameState, offerId: string, packs: number): CommerceResult { const o=SUPPLIER_OFFERS.find(x=>x.id===offerId); if(!o)return{ok:false,reason:'unknown-offer'}; if(!Number.isInteger(packs)||packs<1)return{ok:false,reason:'invalid-quantity'}; const total=o.price*packs; if(s.credits<total)return{ok:false,reason:'insufficient-credits'}; const qty=o.packQty*packs; const old=s.inventory[o.item]||0; const q=s.stockQuality[o.item]; s.credits-=total; s.inventory[o.item]=old+qty; s.stockQuality[o.item]={quantity:old+qty,average:q?(q.average*old+o.grade*qty)/(old+qty):o.grade}; s.commerce.unitsBought+=qty; s.commerce.directSpend+=total; return{ok:true,total}; }
export function sellStock(s: GameState, item: Item, quantity: number): CommerceResult { const unit=SALE_PRICES[item]; if(!unit)return{ok:false,reason:'unsaleable-item'}; if(!Number.isInteger(quantity)||quantity<1)return{ok:false,reason:'invalid-quantity'}; if((s.inventory[item]||0)<quantity)return{ok:false,reason:'insufficient-stock'}; const grade=s.stockQuality[item]?.average??s.quality; const total=Math.floor(unit*quantity*(0.75+grade/400)); s.inventory[item]-=quantity; if(s.stockQuality[item]){if(s.stockQuality[item]!.quantity<=quantity)delete s.stockQuality[item];else s.stockQuality[item]!.quantity-=quantity;} s.credits+=total; s.commerce.unitsSold+=quantity; s.commerce.directRevenue+=total; return{ok:true,total}; }


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
  spcFundamentals:{id:'spcFundamentals',label:'SPC Fundamentals',cost:420,prerequisites:['quality'],description:'Track accepted output samples.',effects:['Shows samples and enables basic capability reporting.']},
  processCapability:{id:'processCapability',label:'Advanced Process Capability',cost:700,prerequisites:['spcFundamentals','metrology'],description:'Control variation for regulated work.',effects:['Improves spread and unlocks aerospace certification.']},
  milling:{id:'milling',label:'Milling',cost:320,prerequisites:['machining'],description:'Machine plates and brackets.',effects:['Unlocks Manual Mill.'],unlocks:['mill']},
  cncMachining:{id:'cncMachining',label:'CNC Machining',cost:850,prerequisites:['milling','processCapability'],description:'High capability automated machining.',effects:['Unlocks CNC lathe and mill.'],unlocks:['cncLathe','cncMill']},
  aerospaceCertification:{id:'aerospaceCertification',label:'Aerospace Certification',cost:900,prerequisites:['processCapability'],description:'Certified aerospace production.',effects:['Eligible for aerospace contracts.']},
  medicalCertification:{id:'medicalCertification',label:'Medical Certification',cost:950,prerequisites:['processCapability','metrology'],description:'Traceable medical production.',effects:['Eligible for medical contracts.']},
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
const BUILDING_KINDS: BuildingKind[] = ['drill', 'furnace', 'lathe', 'mill', 'cncLathe', 'cncMill', 'conveyor', 'storage', 'assembler', 'cmm', 'shipping'];
const ITEMS: Item[] = ['ironOre', 'copperOre', 'coal', 'stone', 'steel', 'copper', 'shaft', 'gear', 'precisionAssembly', 'machinedPlate', 'bracket', 'precisionHousing'];
function dispatchEligible(s: GameState): void {
  for (const contract of s.contracts) {
    if (contract.done || s.tick >= contract.deadline) continue;
    if (contract.requiredResearch && !s.research.includes(contract.requiredResearch)) continue;
    if (meetsContract(s, contract).ok) {
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
  mill: { label: 'Manual Mill', cost: 140, power: 1, color: '#4d9fd9', requiredResearch:'milling' },
  cncLathe: { label: 'CNC Lathe', cost: 520, power: 4, color: '#3478d1', requiredResearch:'cncMachining' },
  cncMill: { label: 'CNC Mill', cost: 600, power: 5, color: '#285aaa', requiredResearch:'cncMachining' },
  conveyor: { label: 'Belt', cost: 25, power: 1, color: '#8193a6', requiredResearch:'workshop' },
  storage: { label: 'Stock Rack', cost: 60, power: 0, color: '#7d9a71', requiredResearch:'workshop' },
  assembler: { label: 'Assembler', cost: 300, power: 8, color: '#af77d8', requiredResearch:'assembly' },
  cmm: { label: 'CMM Bench', cost: 450, power: 4, color: '#63d7ad', requiredResearch:'metrology' },
  shipping: { label: 'Shipping Dock', cost: 220, power: 1, color: '#f0cf6b', requiredResearch:'workshop' },
};

const CONTRACT_TEMPLATES: Contract[] = [
  { id: 'C-101', item: 'steel', qty: 8, minGrade: 65, reward: 480, deadline: 900, done: false, sector:'regular', inspectionLevel:'basic', customer:customerName(0), starter:true },
  { id: 'C-202', item: 'shaft', qty: 4, minGrade: 78, reward: 720, deadline: 1400, done: false, sector:'regular', inspectionLevel:'basic' },
  { id: 'C-303', item: 'copper', qty: 6, minGrade: 70, reward: 520, deadline: 1800, done: false, requiredResearch: 'copper', minReputation: 10 },
  { id: 'C-404', item: 'gear', qty: 3, minGrade: 75, reward: 900, deadline: 2400, done: false, requiredResearch: 'gearing', minReputation: 20 },
  { id: 'C-505', item: 'precisionAssembly', qty: 2, minGrade: 82, reward: 1400, deadline: 3200, done: false, requiredResearch: 'assembly', minReputation: 30 },
  { id: 'C-606', item: 'steel', qty: 16, minGrade: 80, reward: 1100, deadline: 3600, done: false, requiredResearch: 'advancedMaterials', minReputation: 40 },
  { id: 'C-707', item: 'shaft', qty: 8, minGrade: 85, reward: 1500, deadline: 4200, done: false, requiredResearch: 'automation', minReputation: 50 },
  { id: 'C-808', item: 'copper', qty: 12, minGrade: 85, reward: 1200, deadline: 4800, done: false, requiredResearch: 'advancedMaterials', minReputation: 60 },
  { id: 'A-101', item:'precisionHousing', qty:2, minGrade:90, reward:2600, deadline:5200, done:false, sector:'aerospace', requiredResearch:'aerospaceCertification', minCpk:1.33, minSamples:5, inspectionLevel:'certified' },
  { id: 'A-202', item:'shaft', qty:6, minGrade:88, reward:2200, deadline:5000, done:false, sector:'aerospace', requiredResearch:'aerospaceCertification', minCpk:1.33, minSamples:5, inspectionLevel:'certified' },
  { id: 'A-303', item:'machinedPlate', qty:5, minGrade:86, reward:1900, deadline:4700, done:false, sector:'aerospace', requiredResearch:'aerospaceCertification', minCpk:1.2, minSamples:5, inspectionLevel:'traceable' },
  { id: 'M-101', item:'bracket', qty:4, minGrade:92, reward:3000, deadline:5600, done:false, sector:'medical', requiredResearch:'medicalCertification', minCpk:1.67, minSamples:8, inspectionLevel:'certified' },
  { id: 'M-202', item:'precisionHousing', qty:3, minGrade:94, reward:3600, deadline:6000, done:false, sector:'medical', requiredResearch:'medicalCertification', minCpk:1.67, minSamples:8, inspectionLevel:'certified' },
  { id: 'M-303', item:'shaft', qty:8, minGrade:90, reward:2800, deadline:5800, done:false, sector:'medical', requiredResearch:'medicalCertification', minCpk:1.5, minSamples:8, inspectionLevel:'traceable' },
];

const ROTATING_CONTRACT_LIMIT = 3;
const ROTATING_CONTRACTS = [
  { item: 'steel', qty: 4, minGrade: 68, reward: 300 },
  { item: 'shaft', qty: 2, minGrade: 76, reward: 420 },
  { item: 'copper', qty: 4, minGrade: 72, reward: 390, requiredResearch: 'copper' },
] as const;

function makeRotatingContract(sequence: number, tick: number): Contract {
  const offer = ROTATING_CONTRACTS[sequence % ROTATING_CONTRACTS.length];
  return {
    ...offer,
    id: `R-${String(sequence).padStart(4, '0')}`,
    deadline: tick + 900 + (sequence % ROTATING_CONTRACTS.length) * 150,
    done: false,
    sector: 'regular',
    inspectionLevel: 'basic',
    minReputation: 20,
    customer: customerName(sequence + 100),
    starter: false,
    sequence,
  };
}

export function rotateCustomerContracts(s: GameState): void {
  const active = s.contracts.filter((contract) => contract.sequence !== undefined && !contract.done && s.tick < contract.deadline);
  s.contracts = s.contracts.filter((contract) => contract.sequence === undefined);
  while (active.length < ROTATING_CONTRACT_LIMIT) {
    active.push(makeRotatingContract(s.contractSequence, s.tick));
    s.contractSequence++;
  }
  s.contracts.push(...active.slice(0, ROTATING_CONTRACT_LIMIT));
}

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
    contracts: [
      ...structuredClone(CONTRACT_TEMPLATES).map((c, i) => ({ ...c, customer: c.customer || customerName(i), starter: i < 2 })),
      ...[0, 1, 2].map((sequence) => makeRotatingContract(sequence, 0)),
    ],
    paused: false,
    speed: 1,
    selected: null,
    mode: 'select',
    tutorial: 0,
    quality: 72,
    stockQuality: {}, spc: {}, stats: { attempted: 0, accepted: 0, rejected: 0, scrap: 0 }, commerce: { unitsBought: 0, unitsSold: 0, directRevenue: 0, directSpend: 0 }, contractSequence: 3, schemaVersion: 6,
  };
}

export function place(s: GameState, x: number, y: number, kind: BuildingKind): boolean {
  const tile = s.grid[y]?.[x];
  const building = BUILDINGS[kind];
  if (!tile || tile.kind || s.credits < building.cost || !s.research.includes(building.requiredResearch) || (kind === 'drill' && !tile.item)) return false;
  tile.kind = kind;
  tile.condition = 100; tile.cycle = 0;
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
    addStock(s, tile.cargo.item, tile.cargo.quality);
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
  const quality = producedQuality(s, machine, item, x, y);
  if (machine.kind && !['conveyor','storage','shipping','cmm'].includes(machine.kind)) {
    machine.condition = Math.max(0, (machine.condition ?? 100) - 1);
    machine.cycle = (machine.cycle ?? 0) + 1;
  }
  s.stats.attempted++;
  if (quality < rejectionThreshold(s, machine)) { s.stats.rejected++; s.stats.scrap++; return; }
  s.stats.accepted++;
  recordSample(s, item, quality);
  const target = adjacentTile(s, x, y, machine.rot);
  if (target?.kind === 'conveyor' && !target.cargo) {
    target.cargo = { item, quality, progress: 0 };
  } else {
    addStock(s, item, quality);
  }
}

function addStock(s: GameState, item: Item, quality: number): void {
  const old = s.stockQuality[item]; const count = s.inventory[item] || 0;
  s.inventory[item] = count + 1;
  s.stockQuality[item] = { quantity: count + 1, average: old ? (old.average * count + quality) / (count + 1) : quality };
}
function recordSample(s: GameState, item: Item, quality: number): void {
  if (!s.research.includes('spcFundamentals')) return;
  const old = s.spc[item] || { count: 0, mean: 0, m2: 0, standardDeviation: 0, cpk: null };
  const count = old.count + 1; const delta = quality - old.mean; const mean = old.mean + delta / count; const m2 = old.m2 + delta * (quality - mean);
  const sd = count > 1 ? Math.sqrt(Math.max(0, m2 / (count - 1))) : 0;
  s.spc[item] = { count, mean, m2, standardDeviation: sd, cpk: count >= 5 ? Math.max(0, Math.min((100 - mean) / (3 * Math.max(sd, 0.01)), (mean - 0) / (3 * Math.max(sd, 0.01)))) : null };
}
export function capability(s: GameState, item: Item): SpcData | { count: number; mean: number; standardDeviation: number; cpk: null; insufficientSamples: true } {
  const d = s.spc[item];
  if (!d || d.count < 5) return { count: d?.count ?? 0, mean: d?.mean ?? 0, standardDeviation: d?.standardDeviation ?? 0, cpk: null, insufficientSamples: true };
  return d;
}
function producedQuality(s: GameState, machine: Tile, item: Item, x: number, y: number): number {
  const cnc = machine.kind === 'cncLathe' || machine.kind === 'cncMill';
  const base = item === 'steel' || item === 'copper' ? 70 : item === 'gear' ? 74 : machine.kind === 'lathe' ? 69 : cnc ? 90 : 78;
  const research = s.research.includes('quality') ? 10 : 0;
  const metrology = s.research.includes('metrology') ? 8 : 0;
  const measured = s.grid.some(row => row.some(tile => tile.kind === 'cmm'));
  const spread = s.research.includes('processCapability') ? 1 : cnc ? 2 : 5;
  const wear = Math.max(0, 100 - (machine.condition ?? 100)) * 0.25;
  return Math.max(0, Math.min(100, Math.round(base + research + metrology + (measured ? 4 : 0) - wear + ((s.tick + x * 7 + y * 11 + (machine.cycle ?? 0) * 13) % (spread * 2 + 1)) - spread)));
}
function rejectionThreshold(s: GameState, machine: Tile): number { return machine.kind === 'lathe' ? (s.research.includes('quality') ? 72 : 68) : machine.kind === 'mill' ? 70 : 50; }

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
      addStock(s, item, source.cargo.quality);
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
    } else if (['cncLathe'].includes(tile.kind || '') && (s.inventory.steel || 0) >= 1) {
      s.inventory.steel--; outputItem(s, x, y, 'shaft');

    } else if (['mill','cncMill'].includes(tile.kind || '') && (s.inventory.steel || 0) >= 1) {
      s.inventory.steel--; outputItem(s, x, y, tile.kind === 'cncMill' ? 'precisionHousing' : 'machinedPlate');

    } else if (tile.kind === 'assembler' && (s.inventory.gear || 0) >= 1 && (s.inventory.copper || 0) >= 1) {
      s.inventory.gear--; s.inventory.copper--;
      outputItem(s, x, y, 'precisionAssembly');
    }
  }
  return powerUsed;
}

export function tick(s: GameState, steps = 1): void {
  if (s.paused) return;
  for (let i = 0; i < steps; i++) {
    s.tick++;
    rotateCustomerContracts(s);
    advanceCargo(s);
    const powerUsed = processMachines(s);
    if (s.research.includes('automation') && s.tick % 2 === 0) processMachines(s);
    s.power = Math.max(0, 30 - powerUsed);
  }
}

export type FulfillResult = { ok: true } | { ok: false; reason: 'missing' | 'done' | 'stock' | 'quality' | 'expired' | 'locked' | 'capability' | 'inspection' };
export type ContractCheck = { ok: true } | { ok: false; reason: 'stock' | 'quality' | 'capability' | 'inspection' | 'locked' | 'expired' };
export function meetsContract(s: GameState, contract: Contract): ContractCheck {
  if (contract.done) return { ok:false, reason:'locked' };
  if (s.tick >= contract.deadline) return { ok:false, reason:'expired' };
  if ((contract.requiredResearch && !s.research.includes(contract.requiredResearch)) || (contract.minReputation !== undefined && s.reputation < contract.minReputation)) return { ok:false, reason:'locked' };
  if ((s.inventory[contract.item] || 0) < contract.qty) return { ok:false, reason:'stock' };
  const stock = s.stockQuality[contract.item]; const average = stock?.average ?? s.quality;
  if (average < contract.minGrade) return { ok:false, reason:'quality' };
  if (contract.minSamples || contract.minCpk) {
    const c = capability(s, contract.item); if ('insufficientSamples' in c || (contract.minSamples && c.count < contract.minSamples)) return { ok:false, reason:'inspection' };
    if (contract.minCpk && (c.cpk === null || c.cpk < contract.minCpk)) return { ok:false, reason:'capability' };
  }
  return { ok:true };
}

export function fulfillContract(s: GameState, id: string): FulfillResult {
  const contract = s.contracts.find((candidate) => candidate.id === id);
  if (!contract) return { ok: false, reason: 'missing' };
  if (contract.done) return { ok: false, reason: 'done' };
  const check = meetsContract(s, contract); if (!check.ok) return { ok: false, reason: check.reason };
  const stock = s.stockQuality[contract.item];
  const availableStock = stock || ((s.inventory[contract.item] || 0) > 0 ? { quantity: s.inventory[contract.item], average: s.quality } : undefined);
  if ((s.inventory[contract.item] || 0) < contract.qty || !availableStock) return { ok: false, reason: 'stock' };
  if (availableStock.average < contract.minGrade) return { ok: false, reason: 'quality' };
  s.inventory[contract.item] -= contract.qty;
  if (stock && stock.quantity <= contract.qty) delete s.stockQuality[contract.item]; else if (stock) stock.quantity -= contract.qty;
  s.credits += contract.reward;
  s.reputation += 10;
  contract.done = true;
  return { ok: true };
}

export function save(s: GameState): string {
  return JSON.stringify({ ...s, version: 6, schemaVersion: 6 });
}

export type ServiceResult = { ok: true; cost: number } | { ok: false; reason: 'invalid' | 'already-good' | 'insufficient-credits' };
export function serviceMachine(s: GameState, x: number, y: number): ServiceResult {
  const tile = s.grid[y]?.[x]; if (!tile?.kind || ['conveyor','storage','shipping'].includes(tile.kind)) return { ok: false, reason: 'invalid' };
  if ((tile.condition ?? 100) >= 100) return { ok: false, reason: 'already-good' };
  const cost = 40; if (s.credits < cost) return { ok: false, reason: 'insufficient-credits' };
  s.credits -= cost; tile.condition = 100; return { ok: true, cost };
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

function migrateCommerceContracts(value: unknown, tick: unknown): Contract[] {
  const currentTick = Number.isInteger(tick) && (tick as number) >= 0 ? tick as number : 0;
  return [
    ...mergeContractTemplates(value).map((contract, index) => ({
      ...contract,
      customer: contract.customer || customerName(index),
      starter: contract.starter ?? (contract.id === 'C-101' || contract.id === 'C-202'),
    })),
    ...[0, 1, 2].map((sequence) => makeRotatingContract(sequence, currentTick)),
  ];
}

function migrateLegacy(data: Record<string, unknown>): void {
  if (data.version === 5) { data.commerce = data.commerce || { unitsBought: 0, unitsSold: 0, directRevenue: 0, directSpend: 0 }; data.contracts = migrateCommerceContracts(data.contracts, data.tick); data.contractSequence = 3; data.version = 6; data.schemaVersion = 6; return; }
  if (data.version === 4) { data.schemaVersion = 5; data.stockQuality = data.stockQuality || {}; data.spc = data.spc || {}; data.stats = data.stats || { attempted: 0, accepted: 0, rejected: 0, scrap: 0 }; if (Array.isArray(data.grid)) for (const row of data.grid) if (Array.isArray(row)) for (const tile of row) if (isRecord(tile) && tile.kind && !['conveyor','storage','shipping'].includes(tile.kind as string) && tile.condition === undefined) { tile.condition = 100; tile.cycle = 0; } data.contracts = migrateCommerceContracts(data.contracts, data.tick); data.version = 6; data.schemaVersion = 6; data.commerce = data.commerce || { unitsBought: 0, unitsSold: 0, directRevenue: 0, directSpend: 0 }; data.contractSequence = 3; return; }
  if ((data.version !== 1 && data.version !== 2 && data.version !== 3) || !Array.isArray(data.grid)) return;
  if (data.version === 3 && data.grid.length === GRID_HEIGHT) {
    data.stockQuality = data.stockQuality || {}; data.spc = data.spc || {}; data.stats = data.stats || { attempted: 0, accepted: 0, rejected: 0, scrap: 0 };
    data.contracts = migrateCommerceContracts(data.contracts, data.tick);
    data.version = 6; data.schemaVersion = 6; data.commerce = data.commerce || { unitsBought: 0, unitsSold: 0, directRevenue: 0, directSpend: 0 }; data.contractSequence = 3;
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
  data.contracts = migrateCommerceContracts(data.contracts, data.tick);
  data.version = 6; data.schemaVersion = 6; data.commerce = data.commerce || { unitsBought: 0, unitsSold: 0, directRevenue: 0, directSpend: 0 }; data.contractSequence = 3;
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

function isGameState(value: unknown): value is GameState & { version: 6 } {
  if (!isRecord(value) || value.version !== 6 || value.schemaVersion !== 6) return false;
  if (!Number.isInteger(value.tick) || (value.tick as number) < 0) return false;
  if (!isFiniteNonNegative(value.credits) || !isFiniteNonNegative(value.power) || !isFiniteNonNegative(value.reputation)) return false;
  if (!isFiniteNonNegative(value.tutorial) || !isFiniteNonNegative(value.quality) || (value.quality as number) > 100) return false;
  if (!Array.isArray(value.research) || !value.research.every((entry) => typeof entry === 'string' && RESEARCH_IDS.includes(entry))) return false;
  if (!Array.isArray(value.grid) || value.grid.length !== GRID_HEIGHT) return false;
  if (!value.grid.every((row) => Array.isArray(row) && row.length === GRID_WIDTH && row.every(isTile))) return false;
  if (!isInventory(value.inventory)) return false;
  if (!isRecord(value.stockQuality) || !Object.values(value.stockQuality).every(v => isRecord(v) && isIntegerInRange(v.quantity, 0, Number.MAX_SAFE_INTEGER) && isFiniteNonNegative(v.average) && v.average <= 100)) return false;
  if (!isRecord(value.spc) || !Object.values(value.spc).every(v => isRecord(v) && isIntegerInRange(v.count, 0, Number.MAX_SAFE_INTEGER) && isFiniteNonNegative(v.mean) && isFiniteNonNegative(v.m2) && isFiniteNonNegative(v.standardDeviation) && (v.cpk === null || isFiniteNonNegative(v.cpk)))) return false;
  if (!isRecord(value.stats) || !['attempted','accepted','rejected','scrap'].every(k => { const n = (value.stats as Record<string, unknown>)[k]; return Number.isInteger(n) && (n as number) >= 0; }) || (value.stats as any).attempted !== (value.stats as any).accepted + (value.stats as any).rejected || (value.stats as any).scrap !== (value.stats as any).rejected) return false;
  if (!Array.isArray(value.contracts) || !value.contracts.every(isContract)) return false;
  if (!isRecord(value.commerce) || !['unitsBought','unitsSold','directRevenue','directSpend'].every(k => isFiniteNonNegative((value.commerce as Record<string, unknown>)[k]))) return false;
  if (!Number.isInteger(value.contractSequence) || (value.contractSequence as number) < 0) return false;
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
