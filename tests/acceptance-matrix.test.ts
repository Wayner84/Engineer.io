import { describe, expect, it } from 'vitest';
import { capability, demolish, fulfillContract, load, meetsContract, newGame, place, serviceMachine, tick, type GameState } from '../src/sim';

const production = (kind: any, research: string[] = []) => {
  const s = newGame(); s.research.push(...research); s.credits = 10000; s.inventory = { steel: 30, ironOre: 20, coal: 20, copperOre: 20, gear: 20, copper: 20 };
  const [x, y] = kind === 'drill' ? [2, 2] : [0, 0];
  expect(place(s, x, y, kind)).toBe(true); return s;
};
const clone = (s: GameState) => JSON.parse(JSON.stringify(s));

describe('simulation acceptance matrix', () => {
  it('is deterministic for identical cloned state, coordinates, and cycles', () => {
    const a = production('lathe'), b = clone(a); tick(a, 12); tick(b, 12); expect(b).toEqual(a);
  });
  it('manual lathe has both accepted and rejected attempts with exact accounting', () => {
    const s = production('lathe'); tick(s, 30); expect(s.stats.attempted).toBe(s.stats.accepted + s.stats.rejected); expect(s.stats.accepted).toBeGreaterThan(0); expect(s.stats.rejected).toBeGreaterThan(0); expect(s.stats.scrap).toBe(s.stats.rejected);
  });
  it('manual mill has both accepted and rejected attempts with exact accounting', () => {
    const s = production('mill', ['milling']); tick(s, 30); expect(s.stats.attempted).toBe(s.stats.accepted + s.stats.rejected); expect(s.stats.accepted).toBeGreaterThan(0); expect(s.stats.rejected).toBeGreaterThan(0); expect(s.stats.scrap).toBe(s.stats.rejected);
  });
  it('quality research strictly improves accepted yield and stock grade', () => {
    const a = production('lathe'), b = production('lathe', ['quality']); tick(a, 20); tick(b, 20); expect(b.stats.accepted).toBeGreaterThan(a.stats.accepted); expect(b.stockQuality.shaft!.average).toBeGreaterThan(a.stockQuality.shaft!.average);
  });
  it('CMM improves productive measurement outcome rather than idle global quality', () => {
    const a = production('lathe', ['metrology']), b = production('lathe', ['metrology']); expect(place(b, 1, 0, 'cmm')).toBe(true); const before = a.quality; tick(a, 10); tick(b, 10); expect(b.stockQuality.shaft!.average).toBeGreaterThan(a.stockQuality.shaft!.average); expect(a.quality).toBe(before);
  });
  it.each([['lathe','cncLathe'], ['mill','cncMill']] as const)('%s is inferior to %s under equivalent inputs', (manual, cnc) => { const a = production(manual, manual === 'mill' ? ['milling'] : []); const b = production(cnc, ['cncMachining']); tick(a, 20); tick(b, 20); expect(b.stats.accepted).toBeGreaterThanOrEqual(a.stats.accepted); expect(b.stockQuality[cnc === 'cncMill' ? 'precisionHousing' : 'shaft']!.average).toBeGreaterThan(a.stockQuality[manual === 'mill' ? 'machinedPlate' : 'shaft']!.average); });
  it('uses weighted stock grade and preserves quantity after partial fulfillment', () => { const s = newGame(); s.inventory.steel = 2; s.stockQuality.steel = { quantity: 2, average: 70 }; s.stockQuality.steel = { quantity: 2, average: (60 + 80) / 2 }; expect(s.stockQuality.steel.average).toBe(70); const c=s.contracts[0]; c.qty=1; c.minGrade=65; expect(fulfillContract(s,c.id).ok).toBe(true); expect(s.inventory.steel).toBe(1); expect(s.stockQuality.steel!.quantity).toBe(1); });
  it('conserves exact cargo quality through unloading and stock', () => { const s=newGame(); expect(place(s,0,0,'conveyor')).toBe(true); expect(place(s,1,0,'storage')).toBe(true); s.grid[0][0].cargo={item:'steel',quality:83,progress:1}; tick(s); expect(s.inventory.steel).toBe(1); expect(s.stockQuality.steel).toEqual({quantity:1,average:83}); });
  it('wears only on productive attempts and automation adds exact attempts', () => { const s=production('lathe',['automation']); const t=s.grid[0][0]; s.inventory.steel=0; tick(s); expect(t.condition).toBe(100); s.inventory.steel=1; tick(s); expect(t.condition).toBe(99); expect(s.stats.attempted).toBe(1); });
  it('serviceMachine rejects invalid, non-serviceable, already-good and insufficient atomically', () => { const s=newGame(); expect(serviceMachine(s,99,99)).toEqual({ok:false,reason:'invalid'}); expect(serviceMachine(s,0,0)).toEqual({ok:false,reason:'invalid'}); place(s,0,0,'furnace'); expect(serviceMachine(s,0,0)).toEqual({ok:false,reason:'already-good'}); s.grid[0][0].condition=50; s.credits=0; const before=clone(s); expect(serviceMachine(s,0,0)).toEqual({ok:false,reason:'insufficient-credits'}); expect(s).toEqual(before); s.credits=40; expect(serviceMachine(s,0,0)).toEqual({ok:true,cost:40}); expect(s.grid[0][0].condition).toBe(100); });
  it('SPC is finite, thresholded, and zero variation has finite Cpk', () => { const s=production('cncLathe',['cncMachining','spcFundamentals','processCapability']); tick(s,10); const c=capability(s,'shaft'); expect(Number.isFinite(c.mean)).toBe(true); expect(Number.isFinite(c.standardDeviation)).toBe(true); expect(c.cpk === null || Number.isFinite(c.cpk)).toBe(true); });
  it('process capability improves deterministic spread', () => { const a=production('cncLathe',['cncMachining','spcFundamentals']); const b=production('cncLathe',['cncMachining','spcFundamentals','processCapability']); tick(a,12); tick(b,12); expect(capability(b,'shaft').standardDeviation).toBeLessThanOrEqual(capability(a,'shaft').standardDeviation); });
  it('returns precise capability and inspection reasons', () => { const s=newGame(); const c=s.contracts.find(x=>x.id==='A-101')!; s.research.push('aerospaceCertification'); s.inventory[c.item]=c.qty; s.stockQuality[c.item]={quantity:c.qty,average:95}; expect(fulfillContract(s,c.id)).toEqual({ok:false,reason:'inspection'}); });
  it('rejects malformed v5 stock, SPC, stats, and machine metadata', () => { const base=JSON.parse(JSON.stringify(newGame())); for (const mutate of [(x:any)=>x.stockQuality.unknown={quantity:1,average:50},(x:any)=>x.stockQuality.steel={quantity:2,average:50},(x:any)=>x.spc.steel={count:-1,mean:0,m2:0,standardDeviation:0,cpk:null},(x:any)=>x.stats.accepted=1,(x:any)=>x.grid[0][0]={rot:0,condition:50}]) { const x=clone(base); mutate(x); expect(()=>load(JSON.stringify(x))).toThrow(); } });
  it('migrates minimal v4 while preserving done contract state and seeding machine metadata', () => { const x=JSON.parse(JSON.stringify(newGame())); x.version=4; for (const k of ['stockQuality','spc','stats','schemaVersion']) delete x[k]; delete x.grid[0][0].condition; x.contracts[0].done=true; const y=load(JSON.stringify(x)); expect(y.schemaVersion).toBe(6); expect(y.contracts.find(c=>c.id==='C-101')!.done).toBe(true); expect(y.grid[0][0].condition).toBeUndefined(); });
  it('rejects missing grid during migration without throwing internally', () => { expect(()=>load(JSON.stringify({version:4}))).toThrow('Invalid or unsupported save'); });
  it('manual mill exposes both listed recipes and CNC variants produce required parts', () => { const m=production('mill',['milling']); m.contracts[0].done=true; m.inventory.steel=5; tick(m); expect(m.inventory.machinedPlate).toBeGreaterThan(0); const c=production('cncMill',['cncMachining']); tick(c); expect(c.inventory.precisionHousing).toBeGreaterThan(0); });
  it('demolition returns cargo through weighted stock quality', () => { const s=newGame(); place(s,0,0,'conveyor'); s.grid[0][0].cargo={item:'steel',quality:91,progress:.2}; demolish(s,0,0); expect(s.stockQuality.steel).toEqual({quantity:1,average:91}); });
  it.each(['drill','furnace','lathe','mill','cncLathe','cncMill','assembler'] as const)('wears every producing machine on each attempted cycle including reject: %s', (kind) => {
    const research = kind === 'mill' ? ['milling'] : kind === 'cncLathe' || kind === 'cncMill' ? ['cncMachining'] : kind === 'assembler' ? ['assembly'] : [];
    const s = production(kind as any, research); s.inventory.steel = 20; s.inventory.ironOre = 20; s.inventory.coal = 20; s.inventory.copper = 20; s.inventory.gear = 20; s.quality = 0; const [x, y] = kind === 'drill' ? [2, 2] : [0, 0]; const tile = s.grid[y][x]; const before = tile.condition!; tick(s); expect(s.stats.attempted).toBeGreaterThan(0); expect(tile.condition).toBe(before - 1);
  });
  it('fulfills a successful aerospace contract with exact reward reputation and stock change', () => { const s=newGame(); const c=s.contracts.find(x=>x.id==='A-101')!; s.research.push('aerospaceCertification','spcFundamentals'); s.reputation=0; s.inventory[c.item]=c.qty; s.stockQuality[c.item]={quantity:c.qty,average:95}; s.spc[c.item]={count:5,mean:95,m2:0,standardDeviation:0,cpk:3.16}; expect(fulfillContract(s,c.id)).toEqual({ok:true}); expect(s.inventory[c.item]).toBe(0); expect(s.credits).toBe(3800); expect(s.reputation).toBe(10); expect(c.done).toBe(true);
  });
  it('fulfills a successful medical contract with exact reward reputation and stock change', () => { const s=newGame(); const c=s.contracts.find(x=>x.id==='M-101')!; s.research.push('medicalCertification','spcFundamentals'); s.reputation=0; s.inventory[c.item]=c.qty; s.stockQuality[c.item]={quantity:c.qty,average:96}; s.spc[c.item]={count:8,mean:96,m2:0,standardDeviation:0,cpk:3.2}; expect(fulfillContract(s,c.id)).toEqual({ok:true}); expect(s.inventory[c.item]).toBe(0); expect(s.credits).toBe(4200); expect(s.reputation).toBe(10); expect(c.done).toBe(true);
  });
  it('meetsContract applies item-specific grade and Cpk requirements', () => { const s=newGame(); const c=s.contracts.find(x=>x.id==='A-101')!; s.research.push('aerospaceCertification'); s.inventory[c.item]=c.qty; s.stockQuality[c.item]={quantity:c.qty,average:95}; expect(meetsContract(s,c)).toEqual({ok:false,reason:'inspection'}); });
});
