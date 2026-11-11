import { describe, expect, it } from 'vitest';
import { BUILDINGS, type BuildingKind, demolish, fulfillContract, load, newGame, place, save, tick } from '../src/sim';

describe('Engineer.io simulation', () => {
  it('starts with deposits and starter economy', () => { const s = newGame(); expect(s.credits).toBe(1200); expect(s.grid[2][2].item).toBe('ironOre'); });
  it('rejects a drill away from a deposit without charging credits', () => { const s = newGame(); expect(place(s, 0, 0, 'drill')).toBe(false); expect(s.credits).toBe(1200); });
  it('places a drill without destroying the deposit and extracts its resource', () => {
    for (const [x, y, item] of [[2, 2, 'ironOre'], [4, 8, 'copperOre'], [14, 3, 'coal'], [13, 9, 'stone']] as const) { const s = newGame(); place(s, x, y, 'drill'); expect(s.grid[y][x].item).toBe(item); tick(s); expect(s.inventory[item]).toBeGreaterThan(0); }
  });
  it('keeps charging power for a drill after its deposit is exhausted', () => { const s = newGame(); const deposit = s.grid[2][2]; deposit.amount = 1; place(s, 2, 2, 'drill'); const before = s.inventory.ironOre; tick(s); expect(deposit.amount).toBe(0); expect(s.inventory.ironOre).toBe(before + 1); expect(s.power).toBe(27); tick(s); expect(s.inventory.ironOre).toBe(before + 1); expect(s.power).toBe(27); });
  it('charges the declared power cost for every building', () => {
    for (const kind of Object.keys(BUILDINGS) as BuildingKind[]) { const s = newGame(); s.credits = 10_000; const [x, y] = kind === 'drill' ? [2, 2] : [0, 0]; expect(place(s, x, y, kind)).toBe(true); tick(s); expect(s.power).toBe(Math.max(0, 30 - BUILDINGS[kind].power)); }
  });
  it('places and refunds a building', () => { const s = newGame(); expect(place(s, 2, 2, 'drill')).toBe(true); expect(demolish(s, 2, 2)).toBe(true); expect(s.grid[2][2].item).toBe('ironOre'); expect(s.credits).toBe(1140); });
  it('refines iron ore into steel with coal and copper ore into copper with coal', () => { const s = newGame(); s.inventory = { ironOre: 4, copperOre: 3, coal: 3 }; place(s, 0, 0, 'furnace'); place(s, 1, 0, 'furnace'); tick(s); expect(s.inventory.steel).toBe(1); expect(s.inventory.copper).toBe(1); expect(s.inventory.ironOre).toBe(2); expect(s.inventory.copperOre).toBe(2); expect(s.inventory.coal).toBe(1); });
  it('retains the quality-research improvement when a lathe produces a shaft', () => { const s = newGame(); s.research.push('quality'); s.inventory.steel = 1; place(s, 0, 0, 'lathe'); tick(s); expect(s.inventory.shaft).toBe(1); expect(s.quality).toBe(73); });
  it('fulfills a valid contract atomically', () => { const s = newGame(); const c = s.contracts[0]; s.inventory[c.item] = c.qty; s.quality = c.minGrade; expect(fulfillContract(s, c.id).ok).toBe(true); expect(s.inventory[c.item]).toBe(0); expect(s.credits).toBe(1680); expect(s.reputation).toBe(10); expect(c.done).toBe(true); });
  it.each(['low stock', 'low quality', 'expired', 'already done'])('rejects %s contract fulfillment', (reason) => { const s = newGame(); const c = s.contracts[0]; if (reason !== 'low stock') s.inventory[c.item] = c.qty; if (reason === 'low quality') s.quality = c.minGrade - 1; if (reason === 'expired') s.tick = c.deadline; if (reason === 'already done') c.done = true; const before = JSON.stringify(s); expect(fulfillContract(s, c.id).ok).toBe(false); expect(JSON.stringify(s)).toBe(before); });
  it('round trips persistence with deposits under drills', () => { const s = newGame(); place(s, 2, 2, 'drill'); expect(load(save(s)).grid[2][2]).toMatchObject({ kind: 'drill', item: 'ironOre', amount: 999 }); });
  it('migrates legacy v1 drills and refunds off-deposit placements', () => {
    const legacy = JSON.parse(save(newGame())); legacy.version = 1; legacy.credits = 960; legacy.grid[2][2] = { kind: 'drill', rot: 0 }; legacy.grid[0][0] = { kind: 'drill', rot: 1 };
    const migrated = load(JSON.stringify(legacy));
    expect(migrated.grid[2][2]).toMatchObject({ kind: 'drill', item: 'ironOre', amount: 999 });
    expect(migrated.grid[0][0]).toEqual({ rot: 0 });
    expect(migrated.credits).toBe(1080);
    expect(JSON.parse(save(migrated)).version).toBe(2);
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
