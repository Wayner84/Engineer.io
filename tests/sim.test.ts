import { describe, expect, it } from 'vitest';
import { BUILDINGS, CUSTOMER_CATALOGUE, GRID_HEIGHT, GRID_WIDTH, RESEARCH, SUPPLIER_OFFERS, type BuildingKind, beltDirection, buyStock, campaignProgress, customerName, demolish, fulfillContract, load, newGame, place, rotateCustomerContracts, save, sellStock, tick, unlockResearch } from '../src/sim';

describe('Engineer.io simulation', () => {
  it('routes real cargo along belts into a shipping dock and auto-dispatches', () => {
    const s = newGame(); s.inventory.ironOre = 20; s.inventory.coal = 10;
    place(s, 0, 0, 'furnace'); place(s, 1, 0, 'conveyor'); place(s, 2, 0, 'shipping');
    s.grid[1][0].rot = 0; s.grid[0][0].rot = 0;
    for (let i=0;i<12;i++) tick(s);
    expect(s.contracts.some(c => c.done)).toBe(true);
  });
  it('blocks belt cargo instead of overwriting occupied cargo', () => {
    const s = newGame(); place(s, 0, 0, 'conveyor'); place(s, 1, 0, 'conveyor');
    s.grid[0][0].cargo = { item:'steel', quality:80, progress:0.9 };
    s.grid[0][1].cargo = { item:'copper', quality:80, progress:0.9 };
    tick(s); expect(s.grid[0][0].cargo).toBeTruthy(); expect(s.grid[0][1].cargo).toBeTruthy();
  });
  it('exposes a varied registry of research nodes with prerequisites', () => {
    expect(Object.keys(RESEARCH).length).toBeGreaterThanOrEqual(12);
    expect(Object.values(RESEARCH).every(n => n.cost > 0 && n.description && n.effects.length > 0)).toBe(true);
  });
  it('saves and migrates cargo safely', () => {
    const s = newGame(); place(s, 0, 0, 'conveyor'); s.grid[0][0].cargo = { item:'steel', quality:80, progress:.5 };
    expect(load(save(s)).grid[0][0].cargo?.item).toBe('steel');
    const legacy = JSON.parse(save(s)); legacy.version = 3; delete legacy.grid[0][0].cargo;
    expect(load(JSON.stringify(legacy)).grid[0][0].cargo).toBeUndefined();
  });
  it('routes drill output through a turning belt into storage without duplicating stock', () => {
    const s = newGame();
    const before = s.inventory.ironOre;
    expect(place(s, 2, 2, 'drill')).toBe(true);
    s.grid[2][2].rot = 0;
    expect(place(s, 3, 2, 'conveyor')).toBe(true);
    s.grid[2][3].rot = 1;
    expect(place(s, 3, 3, 'conveyor')).toBe(true);
    s.grid[3][3].rot = 0;
    expect(place(s, 4, 3, 'storage')).toBe(true);
    tick(s);
    expect(s.inventory.ironOre).toBe(before);
    expect(s.grid[2][3].cargo?.item).toBe('ironOre');
    tick(s, 6);
    expect(s.inventory.ironOre).toBeGreaterThan(before);
  });
  it('moves existing cargo at most one conveyor cell per simulation step', () => {
    const s = newGame();
    place(s, 0, 0, 'conveyor'); place(s, 1, 0, 'conveyor'); place(s, 2, 0, 'conveyor');
    s.grid[0][0].cargo = { item: 'steel', quality: 80, progress: 1 };
    tick(s);
    expect(s.grid[0][0].cargo).toBeUndefined();
    expect(s.grid[0][1].cargo?.item).toBe('steel');
    expect(s.grid[0][2].cargo).toBeUndefined();
  });
  it('clears conveyor cargo safely when its belt is demolished', () => {
    const s = newGame(); place(s, 0, 0, 'conveyor');
    s.grid[0][0].cargo = { item: 'copper', quality: 80, progress: .5 };
    const before = s.inventory.copper || 0;
    expect(demolish(s, 0, 0)).toBe(true);
    expect(s.grid[0][0].cargo).toBeUndefined();
    expect(s.inventory.copper).toBe(before + 1);
  });
  it('produces achievable gears and precision assemblies without double-counting belt output', () => {
    const s = newGame();
    s.credits = 10_000;
    s.research.push('smelting', 'machining', 'gearing', 'assembly');
    s.inventory = { steel: 10, copper: 10 };
    s.contracts.find(c => c.id === 'C-101')!.done = true;
    s.contracts.find(c => c.id === 'C-202')!.done = true;
    s.contracts.find(c => c.id === 'C-303')!.done = true;
    s.reputation = 30;
    place(s, 0, 0, 'lathe'); place(s, 1, 0, 'conveyor'); place(s, 2, 0, 'storage');
    tick(s);
    expect(s.grid[0][1].cargo?.item).toBe('gear');
    expect(s.inventory.gear || 0).toBe(0);
    tick(s, 4);
    expect(s.inventory.gear).toBeGreaterThan(0);
    place(s, 0, 2, 'assembler');
    tick(s);
    expect(s.inventory.precisionAssembly).toBeGreaterThan(0);
  });
  it('gates advanced contracts until their research and reputation requirements are met', () => {
    const s = newGame(); const advanced = s.contracts.find(c => c.id === 'C-505')!;
    s.inventory[advanced.item] = advanced.qty; s.quality = advanced.minGrade;
    expect(fulfillContract(s, advanced.id)).toEqual({ ok: false, reason: 'locked' });
    s.research.push(advanced.requiredResearch!); s.reputation = advanced.minReputation!;
    expect(fulfillContract(s, advanced.id).ok).toBe(true);
  });
  it('rejects cargo on non-belts and cargo progress outside zero to one', () => {
    const nonBelt = JSON.parse(save(newGame())); nonBelt.grid[0][0].cargo = { item: 'steel', quality: 80, progress: .5 };
    expect(() => load(JSON.stringify(nonBelt))).toThrow();
    const invalidProgress = JSON.parse(save(newGame())); place(invalidProgress, 0, 0, 'conveyor'); invalidProgress.grid[0][0].cargo = { item: 'steel', quality: 80, progress: 1.1 };
    expect(() => load(JSON.stringify(invalidProgress))).toThrow();
  });
  it('normalizes belt rotations into accessible cardinal directions', () => { expect([0, 1, 2, 3, 4, -1].map(beltDirection)).toEqual(['east', 'south', 'west', 'north', 'east', 'north']); });
  it('starts with deposits and starter economy', () => { const s = newGame(); expect(s.credits).toBe(1200); expect(s.grid[2][2].item).toBe('ironOre'); });
  it('extracts coal from every coal deposit and decrements only that deposit', () => {
    const initial = newGame();
    const coalDeposits = initial.grid.flatMap((row, y) => row.map((tile, x) => tile.item === 'coal' ? [x, y] as const : null)).filter((entry): entry is readonly [number, number] => entry !== null);
    for (const [x, y] of coalDeposits) { const s = newGame(); const before = s.grid[y][x].amount!; const coalBefore = s.inventory.coal; expect(place(s, x, y, 'drill')).toBe(true); tick(s); expect(s.inventory.coal).toBe(coalBefore + 1); expect(s.grid[y][x].amount).toBe(before - 1); for (const [ox, oy] of coalDeposits) if (ox !== x || oy !== y) expect(s.grid[oy][ox].amount).toBe(999); }
  });
  it('does not produce coal from non-coal drills', () => { const s = newGame(); const coalBefore = s.inventory.coal; expect(place(s, 2, 2, 'drill')).toBe(true); tick(s); expect(s.inventory.coal).toBe(coalBefore); });
  it('rejects a drill away from a deposit without charging credits', () => { const s = newGame(); expect(place(s, 0, 0, 'drill')).toBe(false); expect(s.credits).toBe(1200); });
  it('places a drill without destroying the deposit and extracts its resource', () => {
    for (const [x, y, item] of [[2, 2, 'ironOre'], [4, 8, 'copperOre'], [14, 3, 'coal'], [13, 9, 'stone']] as const) { const s = newGame(); place(s, x, y, 'drill'); expect(s.grid[y][x].item).toBe(item); tick(s); expect(s.inventory[item]).toBeGreaterThan(0); }
  });
  it('keeps charging power for a drill after its deposit is exhausted', () => { const s = newGame(); const deposit = s.grid[2][2]; deposit.amount = 1; place(s, 2, 2, 'drill'); const before = s.inventory.ironOre; tick(s); expect(deposit.amount).toBe(0); expect(s.inventory.ironOre).toBe(before + 1); expect(s.power).toBe(27); tick(s); expect(s.inventory.ironOre).toBe(before + 1); expect(s.power).toBe(27); });
  it('charges the declared power cost for every building', () => {
    for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) { const s = newGame(); s.credits = 10_000; const required = BUILDINGS[kind].requiredResearch; if (required !== 'workshop') s.research.push(required); const [x, y] = kind === 'drill' ? [2, 2] : [0, 0]; expect(place(s, x, y, kind)).toBe(true); tick(s); expect(s.power).toBe(Math.max(0, 30 - BUILDINGS[kind].power)); }
  });
  it('places and refunds a building', () => { const s = newGame(); expect(place(s, 2, 2, 'drill')).toBe(true); expect(demolish(s, 2, 2)).toBe(true); expect(s.grid[2][2].item).toBe('ironOre'); expect(s.credits).toBe(1140); });
  it('refines iron ore into steel with coal and copper ore into copper with coal', () => { const s = newGame(); s.inventory = { ironOre: 4, copperOre: 3, coal: 3 }; place(s, 0, 0, 'furnace'); place(s, 1, 0, 'furnace'); tick(s); expect(s.inventory.steel).toBe(1); expect(s.inventory.copper).toBe(1); expect(s.inventory.ironOre).toBe(2); expect(s.inventory.copperOre).toBe(2); expect(s.inventory.coal).toBe(1); });
  it('retains the quality-research improvement when a lathe produces a shaft', () => { const s = newGame(); s.research.push('quality'); s.inventory.steel = 1; place(s, 0, 0, 'lathe'); tick(s); expect(s.inventory.shaft).toBe(1); expect(s.quality).toBe(74); });
  it('fulfills a valid contract atomically', () => { const s = newGame(); const c = s.contracts[0]; s.inventory[c.item] = c.qty; s.quality = c.minGrade; expect(fulfillContract(s, c.id).ok).toBe(true); expect(s.inventory[c.item]).toBe(0); expect(s.credits).toBe(1680); expect(s.reputation).toBe(10); expect(c.done).toBe(true); });
  it.each(['low stock', 'low quality', 'expired', 'already done'])('rejects %s contract fulfillment', (reason) => { const s = newGame(); const c = s.contracts[0]; if (reason !== 'low stock') s.inventory[c.item] = c.qty; if (reason === 'low quality') s.quality = c.minGrade - 1; if (reason === 'expired') s.tick = c.deadline; if (reason === 'already done') c.done = true; const before = JSON.stringify(s); expect(fulfillContract(s, c.id).ok).toBe(false); expect(JSON.stringify(s)).toBe(before); });
  it('unlocks research atomically and rejects invalid purchases', () => {
    const s = newGame(); const original = JSON.stringify(s);
    expect(unlockResearch(s, 'unknown')).toEqual({ ok: false, reason: 'unknown' });
    expect(unlockResearch(s, 'workshop')).toEqual({ ok: false, reason: 'already-unlocked' });
    s.credits = 299; expect(unlockResearch(s, 'quality')).toEqual({ ok: false, reason: 'insufficient-credits' });
    expect(s.research).toEqual(['workshop']);
    const funded = newGame(); const result = unlockResearch(funded, 'quality');
    expect(result.ok).toBe(true); if (result.ok) { expect(result.state.credits).toBe(900); expect(result.state.research).toContain('quality'); }
    expect(JSON.stringify(funded)).toBe(original);
  });
  it('tracks campaign objectives without being fooled by out-of-order buildings', () => {
    const s = newGame(); expect(campaignProgress(s).objective.id).toBe('drill');
    place(s, 0, 0, 'furnace'); place(s, 4, 8, 'drill'); expect(campaignProgress(s).objective.id).toBe('drill');
    place(s, 2, 2, 'drill'); expect(campaignProgress(s).objective.id).toBe('steel');
    s.contracts[0].done = true; expect(campaignProgress(s).objective.id).toBe('quality');
    s.research.push('quality'); expect(campaignProgress(s).objective.id).toBe('coal');
    place(s, 5, 4, 'drill'); expect(campaignProgress(s).objective.id).toBe('lathe');
    place(s, 1, 0, 'lathe'); s.quality = 78; expect(campaignProgress(s).objective.id).toBe('shafts');
    s.contracts[1].done = true; expect(campaignProgress(s).objective.id).toBe('complete');
  });
  it('completes the starter campaign through the intended production loop', () => {
    let s = newGame(); expect(place(s, 2, 2, 'drill')).toBe(true); expect(place(s, 0, 0, 'furnace')).toBe(true);
    tick(s, 8); expect(s.inventory.steel).toBeGreaterThanOrEqual(8); expect(fulfillContract(s, 'C-101').ok).toBe(true);
    const research = unlockResearch(s, 'quality'); expect(research.ok).toBe(true); if (!research.ok) throw new Error('research failed'); s = research.state;
    expect(place(s, 1, 0, 'lathe')).toBe(true); expect(place(s, 5, 4, 'drill')).toBe(true);
    tick(s, 8); expect(s.quality).toBeGreaterThanOrEqual(78); expect(s.inventory.shaft).toBeGreaterThanOrEqual(4);
    expect(fulfillContract(s, 'C-202').ok).toBe(true); expect(campaignProgress(s).objective.id).toBe('complete'); expect(s.tick).toBeLessThan(1400);
  });
  it('round trips persistence with deposits under drills', () => { const s = newGame(); place(s, 2, 2, 'drill'); expect(load(save(s)).grid[2][2]).toMatchObject({ kind: 'drill', item: 'ironOre', amount: 999 }); });
  it('migrates legacy v1 drills and refunds off-deposit placements without inventing deposits under old buildings', () => {
    const legacy = JSON.parse(save(newGame())); legacy.version = 1; legacy.grid = legacy.grid.slice(0, 12).map((row: unknown[]) => row.slice(0, 18)); legacy.credits = 840; legacy.grid[2][2] = { kind: 'drill', rot: 0 }; legacy.grid[0][0] = { kind: 'drill', rot: 1 }; legacy.grid[4][5] = { kind: 'drill', rot: 2 }; legacy.grid[2][6] = { kind: 'furnace', rot: 3 };
    const migrated = load(JSON.stringify(legacy));
    expect(migrated.grid[2][2]).toMatchObject({ kind: 'drill', item: 'ironOre', amount: 999 });
    expect(migrated.grid[0][0]).toEqual({ rot: 0 });
    expect(migrated.grid[4][5]).toEqual({ rot: 0 });
    expect(migrated.grid[2][6]).toEqual({ kind: 'furnace', rot: 3 });
    expect(migrated.credits).toBe(1080);
    expect(JSON.parse(save(migrated)).version).toBe(6);
  });
  it('migrates valid v2 18x12 saves into the enlarged map without overwriting old state', () => {
    const legacy = JSON.parse(save(newGame())); legacy.version = 2; legacy.grid = legacy.grid.slice(0, 12).map((row: unknown[]) => row.slice(0, 18)); legacy.grid[0][0] = { kind: 'furnace', rot: 2 }; legacy.inventory.coal = 37;
    const migrated = load(JSON.stringify(legacy));
    expect(migrated.grid).toHaveLength(18); expect(migrated.grid[0]).toHaveLength(30); expect(migrated.grid[0][0]).toMatchObject({ kind: 'furnace', rot: 2 }); expect(migrated.inventory.coal).toBe(37); expect(JSON.parse(save(migrated)).version).toBe(6);
  });
  it('rejects malformed current v3 dimensions', () => { const current = JSON.parse(save(newGame())); current.grid = current.grid.slice(0, 17); expect(() => load(JSON.stringify(current))).toThrow(); });
  it('rotates a bounded deterministic set of customer contracts', () => {
    const s = newGame();
    expect(s.contracts.filter((contract) => contract.sequence !== undefined).map((contract) => contract.id)).toEqual(['R-0000', 'R-0001', 'R-0002']);
    s.contracts.find((contract) => contract.id === 'R-0000')!.done = true;
    rotateCustomerContracts(s);
    const rotating = s.contracts.filter((contract) => contract.sequence !== undefined);
    expect(rotating.map((contract) => contract.id)).toEqual(['R-0001', 'R-0002', 'R-0003']);
    expect(rotating).toHaveLength(3);
    expect(s.contractSequence).toBe(4);
  });
  it('replenishes completed rotating contracts on the next simulation tick', () => {
    const s = newGame();
    s.contracts.find((contract) => contract.id === 'R-0000')!.done = true;
    tick(s);
    expect(s.contracts.filter((contract) => contract.sequence !== undefined).map((contract) => contract.id)).toEqual(['R-0001', 'R-0002', 'R-0003']);
  });
  it('exposes exactly 1,000 unique deterministic customer names', () => {
    expect(CUSTOMER_CATALOGUE).toHaveLength(1000);
    expect(new Set(CUSTOMER_CATALOGUE).size).toBe(1000);
    expect(customerName(0)).toBe(CUSTOMER_CATALOGUE[0]);
    expect(customerName(1000)).toBe(CUSTOMER_CATALOGUE[0]);
    expect(customerName(-1)).toBe(CUSTOMER_CATALOGUE[999]);
  });
  it('purchases supplier stock with exact weighted grade, credits, and commerce totals', () => {
    const s = newGame();
    s.inventory.steel = 5;
    s.stockQuality.steel = { quantity: 5, average: 90 };
    const offer = SUPPLIER_OFFERS.find((candidate) => candidate.id === 'steel')!;
    expect(buyStock(s, offer.id, 2)).toEqual({ ok: true, total: 420 });
    expect(s.credits).toBe(780);
    expect(s.inventory.steel).toBe(15);
    expect(s.stockQuality.steel).toEqual({ quantity: 15, average: 84.66666666666667 });
    expect(s.commerce).toEqual({ unitsBought: 10, unitsSold: 0, directRevenue: 0, directSpend: 420 });
  });
  it('sells stock directly without reputation and rejects failed sales atomically', () => {
    const s = newGame();
    s.inventory.steel = 3;
    s.stockQuality.steel = { quantity: 3, average: 80 };
    expect(sellStock(s, 'steel', 2)).toEqual({ ok: true, total: 228 });
    expect(s.credits).toBe(1428);
    expect(s.inventory.steel).toBe(1);
    expect(s.stockQuality.steel).toEqual({ quantity: 1, average: 80 });
    expect(s.reputation).toBe(0);
    expect(s.commerce).toEqual({ unitsBought: 0, unitsSold: 2, directRevenue: 228, directSpend: 0 });
    const before = structuredClone(s);
    expect(sellStock(s, 'steel', 2)).toEqual({ ok: false, reason: 'insufficient-stock' });
    expect(s).toEqual(before);
  });
  it('migrates genuine v5 commerce defaults and deterministic rotating contracts', () => {
    const legacy = JSON.parse(save(newGame()));
    legacy.version = 5;
    legacy.schemaVersion = 5;
    delete legacy.commerce;
    delete legacy.contractSequence;
    legacy.contracts = legacy.contracts.filter((contract: { sequence?: number }) => contract.sequence === undefined);
    for (const contract of legacy.contracts) {
      delete contract.customer;
      delete contract.starter;
      delete contract.sequence;
    }
    legacy.contracts[0].done = true;
    const migrated = load(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe(6);
    expect(migrated.commerce).toEqual({ unitsBought: 0, unitsSold: 0, directRevenue: 0, directSpend: 0 });
    expect(migrated.contracts.find((contract) => contract.id === 'C-101')!.done).toBe(true);
    expect(migrated.contracts.filter((contract) => contract.sequence !== undefined).map((contract) => contract.id)).toEqual(['R-0000', 'R-0001', 'R-0002']);
    expect(migrated.contractSequence).toBe(3);
  });
  it('fails safely for malformed or unsupported saves', () => {
    expect(() => load('{bad')).toThrow();
    expect(() => load(JSON.stringify({ version: 99 }))).toThrow();
    const valid = JSON.parse(save(newGame()));
    for (const mutate of [
      (x: any) => { x.grid = [[]]; },
      (x: any) => { x.grid[0] = null; },
      (x: any) => { x.grid[0][0].kind = 'teleporter'; },
      (x: any) => { x.grid[0][0].rot = 9; },
      (x: any) => { x.inventory = null; },
      (x: any) => { x.inventory.ironOre = -1; },
      (x: any) => { x.contracts = [{ id: 4 }]; },
      (x: any) => { x.credits = 'rich'; },
    ]) { const malformed = structuredClone(valid); mutate(malformed); expect(() => load(JSON.stringify(malformed))).toThrow(); }
  });
});

describe('shop-floor quality milestone', () => {
  it('tracks per-item weighted stock quality and rejects low-grade contracts', async () => {
    const { newGame, fulfillContract } = await import('../src/sim');
    const s = newGame();
    expect(s.stockQuality).toBeDefined();
    s.inventory.steel = 2; s.stockQuality.steel = { quantity: 2, average: 60 };
    const c = s.contracts[0]; c.qty = 2;
    expect(fulfillContract(s, c.id)).toEqual({ ok: false, reason: 'quality' });
  });

  it('initializes condition and service is atomic', async () => {
    const { newGame, place, serviceMachine } = await import('../src/sim');
    const s = newGame(); expect(place(s, 0, 0, 'furnace')).toBe(true);
    expect(s.grid[0][0].condition).toBe(100);
    s.grid[0][0].condition = 80; s.credits = 0; const before = JSON.stringify(s);
    expect(serviceMachine(s, 0, 0)).toEqual({ ok: false, reason: 'insufficient-credits' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('migrates v4 saves to v5 quality defaults', async () => {
    const { newGame, save, load } = await import('../src/sim');
    const legacy = JSON.parse(save(newGame())); legacy.version = 4;
    const migrated = load(JSON.stringify(legacy));
    expect(migrated.schemaVersion).toBe(6); expect(migrated.stats.attempted).toBe(0);
  });
});
