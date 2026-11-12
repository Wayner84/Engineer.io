import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BUILDINGS,
  RESEARCH,
  GRID_HEIGHT,
  GRID_WIDTH,
  beltDirection,
  type BuildingKind,
  type GameState,
  type Item,
  campaignProgress,
  demolish,
  fulfillContract,
  load,
  newGame,
  place,
  rotate,
  save,
  serviceMachine,
  tick,
  unlockResearch,
  capability,
  meetsContract,
  buyStock, sellStock, SUPPLIER_OFFERS, BLUEPRINTS, createWorkOrder, cancelWorkOrder, assignWorkOrder,
} from './sim';
import './style.css';

const names: Record<string, string> = {
  ironOre: 'IRON ORE',
  copperOre: 'COPPER ORE',
  coal: 'COAL',
  stone: 'STONE',
  steel: 'STEEL',
  copper: 'COPPER',
  shaft: 'SHAFT',
  gear: 'GEAR',
  precisionAssembly: 'PRECISION ASSY', machinedPlate: 'MACHINED PLATE', bracket: 'BRACKET', precisionHousing: 'PRECISION HOUSING',
};

const deposits: Record<string, { short: string; color: string }> = {
  ironOre: { short: 'FE', color: '#9cb6c5' },
  copperOre: { short: 'CU', color: '#d9855b' },
  coal: { short: 'CO', color: '#f1c566' },
  stone: { short: 'ST', color: '#b8aa8e' },
};

const itemIcons: Record<string,string> = { ironOre:'⛏', copperOre:'◉', coal:'◆', stone:'⬟', steel:'▣', copper:'◎', shaft:'│', gear:'⚙', precisionAssembly:'✦', machinedPlate:'▤', bracket:'⌜', precisionHousing:'⬢' };
const buildingUI: Record<BuildingKind,{icon:string;group:string;desc:string;recipe?:string}> = { drill:{icon:'⛏',group:'RESOURCES',desc:'Extract deposits'}, furnace:{icon:'♨',group:'RESOURCES',desc:'Refine ore',recipe:'ORE + COAL → STEEL'}, lathe:{icon:'◉',group:'MANUAL MACHINING',desc:'Turn shafts',recipe:'STEEL → SHAFT'}, mill:{icon:'▤',group:'MANUAL MACHINING',desc:'Cut plates',recipe:'STEEL → PLATE'}, cncLathe:{icon:'◉',group:'CNC / AUTOMATION',desc:'Automated turning',recipe:'STEEL → SHAFT'}, cncMill:{icon:'▦',group:'CNC / AUTOMATION',desc:'Precision milling',recipe:'STEEL → HOUSING'}, conveyor:{icon:'➜',group:'LOGISTICS',desc:'Move cargo'}, storage:{icon:'▥',group:'LOGISTICS',desc:'Stock finished goods'}, assembler:{icon:'⚙',group:'CNC / AUTOMATION',desc:'Combine components'}, cmm:{icon:'⌁',group:'QUALITY',desc:'Scan variation'}, shipping:{icon:'⇥',group:'LOGISTICS',desc:'Dispatch contracts'} };
type Tab = 'factory' | 'research' | 'orders' | 'store' | 'spc' | 'help';

export function App() {
  const [state, setState] = useState<GameState>(() => {
    try {
      return load(localStorage.getItem('engineer-save') || '');
    } catch {
      return newGame();
    }
  });
  const [tab, setTab] = useState<Tab>('factory');
  const [notice, setNotice] = useState('Select a machine, then click the factory floor.');
  const [zoom, setZoom] = useState(1);
  const [catalogueOpen, setCatalogueOpen] = useState(true);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [inspected, setInspected] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const campaign = campaignProgress(state);

  useEffect(() => {
    const id = window.setInterval(() => {
      setState((current) => {
        const next = structuredClone(current);
        tick(next, next.speed);
        return next;
      });
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let frame = 0; let last = performance.now();
    const animate = (now: number) => { const delta = now - last; last = now; if (!state.paused) setAnimationPhase((phase) => phase + delta * state.speed * 0.004); frame = requestAnimationFrame(animate); };
    frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame);
  }, [state.paused, state.speed]);

  useEffect(() => {
    localStorage.setItem('engineer-save', save(state));
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    const cell = 44 * zoom;
    const width = GRID_WIDTH * cell;
    const height = GRID_HEIGHT * cell;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = '#0c1117';
    context.fillRect(0, 0, width, height);

    for (let y = 0; y < GRID_HEIGHT; y++) {
      for (let x = 0; x < GRID_WIDTH; x++) {
        const tile = state.grid[y][x];
        const px = x * cell;
        const py = y * cell;
        context.strokeStyle = '#304554';
        context.strokeRect(px, py, cell, cell);
        if (tile.item) {
          const deposit = deposits[tile.item] || { short: 'RM', color: '#748b99' };
          context.fillStyle = `${deposit.color}55`;
          context.beginPath();
          context.arc(px + cell / 2, py + cell / 2, Math.max(9, cell * 0.34), 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = deposit.color;
          context.stroke();
          context.fillStyle = deposit.color;
          context.font = 'bold 10px IBM Plex Mono, monospace';
          context.fillText(deposit.short, px + 5, py + 13);
          context.font = '8px IBM Plex Mono, monospace';
          context.fillText(String(tile.amount ?? 0), px + 5, py + cell - 5);
        }
        if (tile.kind && tile.kind !== 'conveyor') {
          context.save();
          context.translate(px + cell / 2, py + cell / 2);
          const pulse = tile.kind === 'furnace' ? 1 + Math.sin(animationPhase) * 0.08 : 1;
          context.rotate(tile.kind === 'drill' ? animationPhase * 0.7 : 0);
          context.scale(pulse, pulse);
          context.fillStyle = BUILDINGS[tile.kind].color;
          if (tile.kind === 'drill') { context.fillRect(-8,-14,16,25); context.fillRect(-18,-18,36,8); context.fillStyle='#18232a'; context.fillRect(-3,8,6,12); }
          else if (tile.kind === 'furnace') { context.fillRect(-16,-12,32,25); context.fillStyle='#ff9b4a'; context.fillRect(-9,-5,18,12); context.fillStyle='#26343c'; context.fillRect(8,-24,8,14); }
          else if (tile.kind === 'lathe') { context.fillRect(-20,8,40,7); context.fillRect(-15,-7,8,16); context.beginPath(); context.arc(10,0,10,0,Math.PI*2); context.fill(); context.strokeStyle='#dce9ee'; context.lineWidth=2; context.beginPath(); context.moveTo(10,0); context.lineTo(10+Math.cos(animationPhase)*9,Math.sin(animationPhase)*9); context.stroke(); }
          else if (tile.kind === 'mill') { const travel=Math.sin(animationPhase)*6; context.fillRect(-19,9,38,7); context.fillRect(-15,-14,8,23); context.fillRect(-9,-14,23,6); context.fillStyle='#d8e2e7'; context.fillRect(6,-8,5,15); context.fillStyle='#18232a'; context.fillRect(-9+travel,3,24,5); }
          else if (tile.kind === 'cncLathe') { context.fillRect(-20,-17,40,34); context.fillStyle='#17242b'; context.fillRect(-14,-11,20,16); context.strokeStyle='#70d4ff'; context.strokeRect(-14,-11,20,16); context.fillStyle='#d8e2e7'; context.beginPath(); context.arc(-4,-3,6,0,Math.PI*2); context.fill(); context.strokeStyle='#17242b'; context.beginPath(); context.moveTo(-4,-3); context.lineTo(-4+Math.cos(animationPhase)*6,-3+Math.sin(animationPhase)*6); context.stroke(); context.fillStyle='#67d6ae'; context.fillRect(11,-12,4,4); }
          else if (tile.kind === 'cncMill') { const plunge=Math.sin(animationPhase)*3; context.fillRect(-20,-18,40,36); context.fillStyle='#17242b'; context.fillRect(-13,-12,21,21); context.strokeStyle='#70d4ff'; context.strokeRect(-13,-12,21,21); context.fillStyle='#d8e2e7'; context.fillRect(-4,-11,5,12+plunge); context.fillStyle='#79909e'; context.fillRect(-10,5,17,4); context.fillStyle='#67d6ae'; context.fillRect(12,-13,4,4); }
          else if (tile.kind === 'storage') { context.strokeStyle='#16242c'; context.lineWidth=3; context.strokeRect(-18,-18,36,36); context.fillRect(-14,-9,9,8); context.fillRect(5,-9,9,8); context.fillRect(-14,5,9,8); context.fillRect(5,5,9,8); }
          else if (tile.kind === 'assembler') { const reach=Math.sin(animationPhase)*5; context.fillRect(-18,10,36,6); context.fillRect(-14,-14,7,24); context.fillRect(7,-14,7,24); context.strokeStyle='#d8e2e7'; context.lineWidth=4; context.beginPath(); context.moveTo(-10,-9); context.lineTo(-3+reach,-1); context.lineTo(0,7); context.moveTo(10,-9); context.lineTo(3-reach,-1); context.lineTo(0,7); context.stroke(); }
          else if (tile.kind === 'cmm') { const scan=Math.sin(animationPhase)*9; context.fillRect(-18,10,36,6); context.fillRect(-15,-16,6,26); context.fillRect(9,-16,6,26); context.fillRect(-15,-18,30,6); context.fillStyle='#d8e2e7'; context.fillRect(scan-2,-12,4,18); context.fillStyle='#e47b61'; context.beginPath(); context.arc(scan,7,2,0,Math.PI*2); context.fill(); }
          else if (tile.kind === 'shipping') { const door=(Math.sin(animationPhase)+1)*5; context.fillRect(-19,-17,38,34); context.fillStyle='#17242b'; context.fillRect(-15,-13+door,30,22-door); context.fillStyle='#70828c'; for(let roller=-14; roller<=14; roller+=7) context.fillRect(roller,-16,3,32); }
          else context.fillRect(-cell / 2 + 7, -cell / 2 + 7, Math.max(8, cell - 14), Math.max(8, cell - 14));
          context.fillStyle = '#101820'; context.font = 'bold 9px IBM Plex Mono, monospace'; context.textAlign = 'center';
          context.fillText(tile.kind.slice(0, 4).toUpperCase(), 0, 3);
          context.restore();
          const condition = tile.condition ?? 100;
          context.fillStyle='#17242b'; context.fillRect(px+5,py+cell-6,cell-10,3);
          context.fillStyle=condition>65?'#67d6ae':condition>30?'#f1c566':'#e47b61'; context.fillRect(px+5,py+cell-6,(cell-10)*condition/100,3);
          const direction = beltDirection(tile.rot);
          const [dx, dy] = direction === 'east' ? [1, 0] : direction === 'south' ? [0, 1] : direction === 'west' ? [-1, 0] : [0, -1];
          context.fillStyle = '#f1c566';
          context.beginPath();
          context.moveTo(px + cell / 2 + dx * cell * .4, py + cell / 2 + dy * cell * .4);
          context.lineTo(px + cell / 2 + dx * cell * .22 - dy * cell * .09, py + cell / 2 + dy * cell * .22 + dx * cell * .09);
          context.lineTo(px + cell / 2 + dx * cell * .22 + dy * cell * .09, py + cell / 2 + dy * cell * .22 - dx * cell * .09);
          context.closePath(); context.fill();
        }
        if (tile.kind === 'conveyor') {
          const direction = beltDirection(tile.rot);
          const vertical = direction === 'north' || direction === 'south';
          const reverse = direction === 'west' || direction === 'north';
          context.save();
          context.translate(px + cell / 2, py + cell / 2);
          if (vertical) context.rotate(Math.PI / 2);
          context.fillStyle = '#11191f';
          context.fillRect(-cell * .47, -cell * .34, cell * .94, cell * .68);
          context.fillStyle = '#70828c';
          context.fillRect(-cell * .47, -cell * .39, cell * .94, cell * .07);
          context.fillRect(-cell * .47, cell * .32, cell * .94, cell * .07);
          context.fillStyle = '#344550';
          for (let roller = 0; roller < 5; roller++) {
            const travel = ((roller / 5 + animationPhase * .18) % 1) - .5;
            const rollerX = (reverse ? -travel : travel) * cell * .88;
            context.fillRect(rollerX - 2, -cell * .29, 4, cell * .58);
          }
          context.restore();
          if (tile.cargo) {
            const colors: Record<string, string> = { ironOre:'#9cb6c5', copperOre:'#d9855b', coal:'#59636a', stone:'#b8aa8e', steel:'#d8e2e7', copper:'#db8c62', shaft:'#6dbad5', gear:'#c28fe3', precisionAssembly:'#67d6ae' };
            const visualProgress = state.paused ? tile.cargo.progress : Math.min(1, tile.cargo.progress + (animationPhase % .3));
            const along = (visualProgress - .5) * cell * .7;
            const cargoX = px + cell / 2 + (direction === 'east' ? along : direction === 'west' ? -along : 0);
            const cargoY = py + cell / 2 + (direction === 'south' ? along : direction === 'north' ? -along : 0);
            context.fillStyle = colors[tile.cargo.item] || '#f1c566';
            context.fillRect(cargoX - cell * .18, cargoY - cell * .18, cell * .36, cell * .36);
            context.strokeStyle = '#f5fbff'; context.strokeRect(cargoX - cell * .18, cargoY - cell * .18, cell * .36, cell * .36);
            context.fillStyle = '#101820'; context.font = 'bold 7px IBM Plex Mono'; context.textAlign = 'center';
            context.fillText(tile.cargo.item.slice(0, 3).toUpperCase(), cargoX, cargoY - 1);
            context.font = 'bold 6px IBM Plex Mono';
            context.fillText(`Q${Math.round(tile.cargo.quality)}`, cargoX, cargoY + 7);
          }
        }
      }
    }
  }, [state, zoom, animationPhase]);

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cell = 44 * zoom;
    const x = Math.floor((event.clientX - rect.left) / cell);
    const y = Math.floor((event.clientY - rect.top) / cell);
    const tile = state.grid[y]?.[x];
    if (!tile) {
      setNotice('That position is outside the usable factory floor.');
      return;
    }

    setState((current) => {
      const next = structuredClone(current);
      const target = next.grid[y][x];
      if (next.mode === 'place' && next.selected) {
        const building = BUILDINGS[next.selected];
        if (target.kind) {
          setNotice(`Cell occupied by ${BUILDINGS[target.kind].label}.`);
          return current;
        }
        if (next.credits < building.cost) {
          setNotice(`Not enough credits for ${building.label}. Need ₡${building.cost}.`);
          return current;
        }
        if (next.selected === 'drill' && !target.item) {
          setNotice('Powered Drills must be placed on a coloured resource deposit.');
          return current;
        }
        place(next, x, y, next.selected);
        setNotice(`${building.label} installed at ${x + 1}, ${y + 1}${next.selected === 'conveyor' ? ', facing east' : ''}.`);
        return next;
      }
      if (next.mode === 'demolish') {
        if (!target.kind) {
          setNotice('There is no machine on that cell to demolish.');
          return current;
        }
        const label = BUILDINGS[target.kind].label;
        demolish(next, x, y);
        setNotice(`${label} demolished. Half its cost was refunded.`);
        return next;
      }
      if (!target.kind) {
        setNotice('Select a machine to rotate it, or choose a building tool.');
        return current;
      }
      setInspected({ x, y });
      next.selected = target.kind;
      setNotice(`${BUILDINGS[target.kind].label} selected at ${x + 1}, ${y + 1}. Use the inspector controls.`);
      return next;
    });
  }

  function reset() {
    const fresh = newGame();
    setState(fresh);
    localStorage.removeItem('engineer-save');
    setNotice('Campaign reset. Start by drilling the FE iron deposit.');
    setTab('factory');
  }

  function objectiveAction() {
    if (campaign.objective.id === 'quality') setTab('research');
    if (campaign.objective.id === 'steel' || campaign.objective.id === 'shafts') setTab('orders');
  }

  function fitFactory() {
    const available = boardRef.current?.clientWidth ?? window.innerWidth - 20;
    setZoom(Math.max(.25, Math.min(1.4, available / (GRID_WIDTH * 44))));
  }

  const actionLabel = campaign.objective.id === 'quality'
    ? 'OPEN RESEARCH'
    : campaign.objective.id === 'steel' || campaign.objective.id === 'shafts'
      ? 'OPEN CONTRACTS'
      : null;

  return (
    <div className="app">
      <header>
        <div className="brand"><span className="mark">E</span><div><b>ENGINEER.IO</b><small>PRECISION MANUFACTURING OS</small></div></div>
        <div className="status"><span>● ONLINE</span><span>SHIFT {Math.floor(state.tick / 120) + 1}</span><span className="credits">₡ {state.credits.toLocaleString()}</span></div>
      </header>
      <div className="layout">
        <aside>
          <button className={tab === 'factory' ? 'active' : ''} onClick={() => setTab('factory')}>▦ FACTORY FLOOR</button>
          <button className={tab === 'research' ? 'active' : ''} onClick={() => setTab('research')}>◇ RESEARCH</button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>▤ CONTRACTS</button><button className={tab === 'store' ? 'active' : ''} onClick={() => setTab('store')}>▥ STORE / MARKET</button>
          <button className={tab === 'spc' ? 'active' : ''} onClick={() => setTab('spc')}>◈ SPC / QUALITY</button>
          <button className={tab === 'help' ? 'active' : ''} onClick={() => setTab('help')}>? FIELD GUIDE</button>
          <div className="side-bottom">
            <button onClick={() => setState((x) => ({ ...x, paused: !x.paused }))}>{state.paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button>
            <button onClick={() => setState((x) => ({ ...x, speed: x.speed === 3 ? 1 : x.speed + 1 }))}>SPEED ×{state.speed}</button>
            <button onClick={reset}>RESET SIM</button>
          </div>
        </aside>
        <main>
          <div className="topline">
            <div><span className="eyebrow">CAMPAIGN / GARAGE WORKSHOP</span><h1>{tab === 'factory' ? 'Production floor' : tab === 'research' ? 'Capability roadmap' : tab === 'orders' ? 'Active contracts' : tab === 'store' ? 'Store / Market' : tab === 'spc' ? 'SPC / quality control' : 'Operator field guide'}</h1></div>
            <div className="kpis">{[['⚡','POWER',`${state.power} kW`,state.power<10?'warn':'good'],['◈','CAPABILITY',`${state.quality}%`,state.quality<70?'warn':'good'],['✓','YIELD',`${state.stats.attempted ? Math.round(state.stats.accepted/state.stats.attempted*100) : 100}%`,'good'],['▥','SCRAP',String(state.stats.scrap),state.stats.scrap?'warn':'good'],['★','REPUTATION',String(state.reputation),'good']].map(([icon,label,value,tone])=><div className={`kpi-card ${tone}`} key={label}><span className="kpi-icon">{icon}</span><span><small>{label}</small><b>{value}</b></span><i className="pulse" /></div>)}</div>
          </div>

          <section className={`objective-card ${campaign.objective.complete ? 'complete' : ''}`} aria-label="Current campaign objective">
            <div><span className="eyebrow">CURRENT OBJECTIVE</span><h2>{campaign.objective.title}</h2><p>{campaign.objective.instructions}</p></div>
            <div className="objective-progress"><strong>{campaign.objective.current} / {campaign.objective.target}</strong><progress value={campaign.objective.current} max={campaign.objective.target} />{actionLabel && <button onClick={objectiveAction}>{actionLabel}</button>}</div>
          </section>

          <p className="notice" role="status" aria-live="polite">{notice}</p>

          {tab === 'factory' ? (
            <>
              <div className="compact-sim-controls" aria-label="Simulation controls">
                <button onClick={() => setState((x) => ({ ...x, paused: !x.paused }))}>{state.paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button>
                <button onClick={() => setState((x) => ({ ...x, speed: x.speed === 3 ? 1 : x.speed + 1 }))}>SPEED ×{state.speed}</button>
              </div>
              <div className="toolbar">
                <button aria-pressed={state.mode === 'select'} className={state.mode === 'select' ? 'chosen' : ''} onClick={() => setState((x) => ({ ...x, mode: 'select' }))}>SELECT / ROTATE</button>
                <button aria-pressed={state.mode === 'demolish'} className={state.mode === 'demolish' ? 'chosen danger' : ''} onClick={() => setState((x) => ({ ...x, mode: 'demolish' }))}>DEMOLISH</button>
                <button className="catalogue-toggle" aria-expanded={catalogueOpen} onClick={() => setCatalogueOpen((open) => !open)}>{catalogueOpen ? 'COLLAPSE MACHINES' : 'EXPAND MACHINES'}</button>
                <div className="catalogue" hidden={!catalogueOpen}>{(['RESOURCES','MANUAL MACHINING','CNC / AUTOMATION','QUALITY','LOGISTICS'] as const).map(group => <section className="catalogue-group" key={group}><h3>{group}</h3><div className="machine-grid">{(Object.keys(BUILDINGS) as BuildingKind[]).filter(kind => buildingUI[kind].group === group).map(kind => { const b=BUILDINGS[kind], ui=buildingUI[kind], locked=!state.research.includes(b.requiredResearch); return <button className={`machine-card ${state.mode==='place'&&state.selected===kind?'chosen':''}`} key={kind} disabled={locked} onClick={() => { setState(x=>({...x,mode:'place',selected:kind})); setNotice(`${b.label} selected. Choose a free cell.`); }}><span className="icon-tile">{ui.icon}</span><span className="machine-copy"><b>{b.label}</b><small>{ui.desc}</small>{ui.recipe&&<small className="recipe">{ui.recipe}</small>}<small>₡{b.cost} · {b.power} kW · {locked?`LOCKED: ${b.requiredResearch}`:'ONLINE'}</small></span></button>})}</div></section>)}</div>
                <div className="view-controls" aria-label="Factory view controls"><button onClick={fitFactory}>FIT</button><button aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(.25, value - .1))}>−</button><button aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.4, value + .1))}>+</button><label>ZOOM <input aria-label="Factory zoom" type="range" min=".25" max="1.4" step=".05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label></div>
              </div>
              <div className="board" ref={boardRef}><canvas ref={canvasRef} onClick={handleCanvasClick} aria-label={`Interactive ${GRID_WIDTH} by ${GRID_HEIGHT} factory floor`} /><div className="legend"><span>{state.mode === 'place' ? 'PLACEMENT MODE' : state.mode === 'demolish' ? 'DEMOLITION MODE' : 'SELECT / ROTATE MODE'}</span><span>BELTS: 0 EAST · 1 SOUTH · 2 WEST · 3 NORTH · SELECT/ROTATE</span><span>COAL: high-contrast CO deposit · TICK {state.tick}</span></div></div>
              <section className="panels"><div><h3>STOCK CONTROL <i>LIVE</i></h3><div className="stock">{Object.entries(state.inventory).map(([key, value]) => { const q=state.stockQuality[key as Item]; return <span className="stock-card" key={key}><em>{itemIcons[key]||'◇'}</em><b>{names[key] || key}</b><strong>{value}</strong><small>AVG {q?.average?.toFixed(0) || state.quality}%</small></span>})}</div></div><div><h3>HOW PRODUCTION WORKS</h3><p>Every active machine reads from shared stock. Condition degrades with cycles; CMM scans build samples and Cpk. Manual machining is flexible, while CNC trades research cost for tighter variation.</p></div></section>{inspected && <Inspector state={state} setState={setState} setNotice={setNotice} position={inspected} />}
            </>
          ) : tab === 'research' ? <Research state={state} setState={setState} setNotice={setNotice} /> : tab === 'orders' ? <Orders state={state} setState={setState} setNotice={setNotice} /> : tab === 'store' ? <Store state={state} setState={setState} setNotice={setNotice} /> : tab === 'spc' ? <Quality state={state} /> : <Guide />}
        </main>
      </div>
    </div>
  );
}

function Inspector({ state, setState, setNotice, position }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>>; position: {x:number;y:number} }) {
  const tile = state.grid[position.y][position.x]; if (!tile.kind) return null;
  const machine = BUILDINGS[tile.kind];
  const ui = buildingUI[tile.kind];
  const condition = tile.condition ?? 100;
  const manual = tile.kind === 'lathe' || tile.kind === 'mill';
  const family = tile.kind === 'lathe' || tile.kind === 'cncLathe' ? 'turning' : tile.kind === 'mill' || tile.kind === 'cncMill' ? 'milling' : tile.kind === 'cmm' ? 'inspection' : null;
  const eligibleOrders = state.workOrders.filter((order) => order.status === 'queued' && BLUEPRINTS.find((blueprint) => blueprint.id === order.blueprintId)?.operations[order.operationIndex]?.family === family);
  const risk = Math.min(80, Math.max(2, Math.round((100 - condition) * .45 + (manual && !state.research.includes('quality') ? 24 : manual ? 10 : 4))));
  return <div className="inspector"><div className="inspector-title"><span className="icon-tile">{ui.icon}</span><div><span className="eyebrow">SHOP / MACHINE INSPECTOR · LIVE</span><h2>{machine.label}</h2><small>GRID {position.x + 1}:{position.y + 1} · OUTPUT {beltDirection(tile.rot).toUpperCase()}</small></div></div><div className="inspector-grid"><span><small>CONDITION</small><b>{condition}%</b><i className="condition-track"><i style={{width:`${condition}%`}} /></i></span><span><small>PRODUCTIVE CYCLES</small><b>{tile.cycle ?? 0}</b></span><span><small>POWER DRAW</small><b>{machine.power} kW</b></span><span><small>SHOP YIELD</small><b>{state.stats.attempted ? Math.round(state.stats.accepted/state.stats.attempted*100) : 100}%</b></span><span><small>PROJECTED REJECTION</small><b>{risk}%</b></span><span><small>PROCESS</small><b>{ui.recipe || ui.desc}</b></span></div>{manual && !state.research.includes('quality') && <p className="upgrade-note">◇ Research Quality Control to reduce manual process variation; SPC and metrology later prove whether output is capable.</p>}<div className="inspector-actions"><button onClick={() => setState((current) => { const next = structuredClone(current); rotate(next, position.x, position.y); setNotice(`${machine.label} rotated to ${beltDirection(next.grid[position.y][position.x].rot)}.`); return next; })}>↻ ROTATE</button><button disabled={condition >= 100} onClick={() => setState((current) => { const next = structuredClone(current); const result = serviceMachine(next, position.x, position.y); setNotice(result.ok ? `${machine.label} serviced for ₡${result.cost}.` : `Service rejected: ${result.reason}.`); return result.ok ? next : current; })}>⌁ SERVICE ₡40</button>{eligibleOrders.map((order) => <button key={order.id} onClick={() => setState((current) => { const next=structuredClone(current); const result=assignWorkOrder(next, order.id, position.x, position.y); setNotice(result.ok ? `${order.id} assigned to ${machine.label}.` : `Assignment rejected: ${result.reason}.`); return result.ok ? next : current; })}>ASSIGN {order.id}</button>)}</div></div>;
}

function Research({ state, setState, setNotice }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>> }) {

  function purchase(id: string, title: string) {
    setState((current) => {
      const result = unlockResearch(current, id);
      if (!result.ok) {
        setNotice(result.reason === 'insufficient-credits' ? `Not enough credits for ${title}.` : result.reason === 'prerequisite' ? `${title} is locked: complete its prerequisites first.` : result.reason === 'already-unlocked' ? `${title} is already unlocked.` : 'Unknown research node.');
        return current;
      }
      setNotice(`${title} research unlocked.`);
      return result.state;
    });
  }
  const groups = [
    ['FOUNDATION', '◆', ['workshop','smelting','copper']],
    ['MACHINING', '⚙', ['machining','gearing','milling']],
    ['QUALITY & SPC', '◈', ['quality','spcFundamentals','metrology','processCapability']],
    ['AUTOMATION', '⌁', ['belts','assembly','automation','logistics','cncMachining']],
    ['REGULATED', '✦', ['advancedMaterials','aerospaceCertification','medicalCertification']],
  ] as const;
  return <div className="research">{groups.map(([label, icon, ids]) => <section className="research-group" key={label}><h3>{icon} {label}</h3>{ids.map((id, index) => { const node=RESEARCH[id]; const unlocked = state.research.includes(node.id); const ready = node.prerequisites.every((p) => state.research.includes(p)); return <article className={unlocked ? 'unlocked' : ready ? 'available' : 'locked'} key={node.id}><div className="node">{index + 1}</div><div><h2>{node.label} {unlocked && <em>UNLOCKED</em>}</h2><p>{node.description}</p><div className="research-chips"><span>PREREQ: {node.prerequisites.join(', ') || 'none'}</span>{node.effects.map(effect=><span key={effect}>{effect}</span>)}</div></div><button disabled={unlocked || !ready} onClick={() => purchase(node.id, node.label)}>{unlocked ? 'ACTIVE' : !ready ? 'LOCKED' : `₡${node.cost} RESEARCH`}</button></article>; })}</section>)}</div>;
}

function Orders({ state, setState, setNotice }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>> }) {
  const hasDock = state.grid.some((row) => row.some((tile) => tile.kind === 'shipping'));
  function queue(blueprintId: string, quantity: number) {
    setState((current) => {
      const next = structuredClone(current);
      const result = createWorkOrder(next, blueprintId, quantity);
      if (!result.ok) {
        const messages = { 'unknown-blueprint': 'Blueprint not found.', 'invalid-quantity': 'Batch quantity must be from 1 to 100.', 'insufficient-stock': 'Not enough material to reserve this batch.', 'insufficient-grade': 'Available material grade is below the blueprint requirement.' };
        setNotice(messages[result.reason]);
        return current;
      }
      setNotice(`${result.workOrderId} queued with its exact material reservation.`);
      return next;
    });
  }
  function cancel(workOrderId: string) {
    setState((current) => {
      const next = structuredClone(current);
      const result = cancelWorkOrder(next, workOrderId);
      if (!result.ok) { setNotice(result.reason === 'active' ? 'Active or completed work orders cannot release reserved material.' : 'Work order not found.'); return current; }
      setNotice(`${workOrderId} cancelled; reserved material returned to stock.`);
      return next;
    });
  }
  function ship(id: string) {
    setState((current) => {
      const next = structuredClone(current);
      const result = fulfillContract(next, id);
      if (!result.ok) {
        const messages = { missing: 'Contract not found.', done: 'That contract is already fulfilled.', stock: 'Not enough finished stock.', quality: 'Quality is below the contract requirement.', expired: 'The contract deadline has passed.', locked: 'Research or reputation requirements are not yet met.', capability: 'Process capability is below the contract requirement.', inspection: 'Required inspection samples are not complete.' };
        setNotice(messages[result.reason]);
        return current;
      }
      setNotice(`${id} shipped successfully. Reward and reputation added.`);
      return next;
    });
  }
  const sectors = [
    { id: 'regular', label: '▣ STANDARD COMMERCIAL' },
    { id: 'aerospace', label: '✈ AEROSPACE' },
    { id: 'medical', label: '✚ MEDICAL' },
  ] as const;
  return <div className="orders"><section className="blueprint-register"><h2>CONTROLLED BLUEPRINT REGISTER</h2><p>Choose an exact batch. Material is reserved immediately at its current grade.</p><div className="blueprint-grid">{BLUEPRINTS.map((blueprint) => <article className="blueprint-card" key={blueprint.id}><div><span className="eyebrow">{blueprint.id} · REV {blueprint.revision}</span><h3>{names[blueprint.product]} · {blueprint.customer}</h3><p>{blueprint.operations.map((operation) => operation.label).join(' → ')}</p><p>{names[blueprint.material]} × {blueprint.materialPerUnit}/unit · minimum grade {blueprint.requiredGrade}% · stock {state.inventory[blueprint.material] || 0}</p></div><div><button onClick={() => queue(blueprint.id, 1)}>QUEUE 1</button><button onClick={() => queue(blueprint.id, 5)}>QUEUE 5</button><button onClick={() => queue(blueprint.id, 10)}>QUEUE 10</button></div></article>)}</div></section><section className="work-order-queue"><h2>WORK-ORDER ROUTES</h2>{state.workOrders.length === 0 ? <p>No batches queued.</p> : state.workOrders.map((order) => { const blueprint=BLUEPRINTS.find((candidate)=>candidate.id===order.blueprintId)!; const operation=blueprint.operations[order.operationIndex]; return <article key={order.id}><b>{order.id} · BATCH {order.quantity} · {order.status.toUpperCase()}</b><span>{order.status === 'completed' ? `${names[blueprint.product]} ${order.acceptedQuantity} completed` : `${operation.label} · ${order.completedQuantity}/${order.quantity}`} · grade {order.reservedGrade.toFixed(0)}%{order.machine ? ` · machine ${order.machine.x+1}:${order.machine.y+1}` : ' · select a compatible machine and assign in its inspector'}</span><button disabled={order.status !== 'queued'} onClick={() => cancel(order.id)}>CANCEL &amp; RELEASE</button></article>; })}</section><p className={`dock-status ${hasDock ? 'online' : ''}`}>{hasDock ? 'SHIPPING DOCK ONLINE · Belt deliveries auto-dispatch the first eligible order.' : 'NO SHIPPING DOCK · Orders can be dispatched manually; build a dock for automatic belt dispatch.'}</p>{sectors.map((sector) => <section className="contract-sector" key={sector.id}><h2>{sector.label}</h2>{state.contracts.filter((contract) => (contract.sector || 'regular') === sector.id).map((contract) => {
    const expired = !contract.done && state.tick >= contract.deadline;
    const stock = state.inventory[contract.item] || 0;
    const researchLocked = !!contract.requiredResearch && !state.research.includes(contract.requiredResearch);
    const reputationLocked = contract.minReputation !== undefined && state.reputation < contract.minReputation;
    const locked = researchLocked || reputationLocked;
    const check = meetsContract(state, contract);
    const blocked = !check.ok;
    const status = contract.done ? 'FULFILLED' : expired ? 'EXPIRED' : check.ok ? 'READY TO SHIP' : check.reason === 'stock' ? 'NEED STOCK' : check.reason === 'quality' ? 'NEED GRADE' : check.reason === 'inspection' ? 'NEED SAMPLES' : check.reason === 'capability' ? 'NEED CPK' : check.reason === 'locked' ? 'CERTIFICATION LOCKED' : 'NEED STOCK';
    return <article className={`sector-${contract.sector || 'regular'} ${locked ? 'locked' : contract.done ? 'unlocked' : ''}`} key={contract.id}><div><p className="customer">CUSTOMER: {contract.customer || 'UNASSIGNED'}</p><span className="sector-badge">{contract.sector === 'aerospace' ? '✈ AEROSPACE' : contract.sector === 'medical' ? '✚ MEDICAL' : '▣ REGULAR'}</span><span className="eyebrow"> {contract.id} / {status}</span><h2>{itemIcons[contract.item]||'◇'} {names[contract.item]} × {contract.qty}</h2><p>Stock <b>{stock}/{contract.qty}</b> · Grade <b>{state.stockQuality[contract.item]?.average?.toFixed(0) || state.quality}% / {contract.minGrade}%</b> · Samples <b>{state.spc[contract.item]?.count || 0}/{contract.minSamples || 0}</b> · Cpk <b>{state.spc[contract.item]?.cpk?.toFixed(2) || '—'} / {contract.minCpk || '—'}</b></p><p>Inspection: {contract.inspectionLevel || 'basic'} · Deadline tick {contract.deadline} · Research: {contract.requiredResearch || 'none'}</p></div><div className="reward">₡ {contract.reward}<button disabled={contract.done || blocked} onClick={() => ship(contract.id)}>{contract.done ? 'FULFILLED' : status}</button></div></article>;
  })}</section>)}</div>;
}

function Store({ state, setState, setNotice }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>> }) {
  const sellable = ['steel','copper','shaft','gear','machinedPlate','bracket','precisionHousing','precisionAssembly'] as Item[];
  const act = (fn: (s: GameState) => { ok: boolean; total?: number; reason?: string }) => setState(current => { const next=structuredClone(current); const r=fn(next); setNotice(r.ok ? `Commerce complete: ₡${r.total}` : `Commerce rejected: ${r.reason}`); return r.ok ? next : current; });
  return <div className="store"><section><h2>PURCHASE STOCK</h2>{SUPPLIER_OFFERS.map(o=><article className="commerce-card" key={o.id}><div><b>{o.supplier}</b><p>{names[o.item]} · pack {o.packQty} · grade {o.grade}% · ₡{o.price}</p></div><button onClick={()=>act(s=>buyStock(s,o.id,1))}>BUY 1</button><button onClick={()=>act(s=>buyStock(s,o.id,5))}>BUY 5</button></article>)}</section><section><h2>DIRECT SALES</h2><p>Immediate payment; no reputation or certification progress. Contracts pay premiums.</p>{sellable.map(item=><article className="commerce-card" key={item}><div><b>{names[item]}</b><p>Stock {state.inventory[item]||0} · grade {(state.stockQuality[item]?.average??state.quality).toFixed(0)}%</p></div><button onClick={()=>act(s=>sellStock(s,item,1))}>SELL 1</button><button onClick={()=>act(s=>sellStock(s,item,5))}>SELL 5</button><button onClick={()=>act(s=>sellStock(s,item,s.inventory[item]||0))}>SELL ALL</button></article>)}</section><div className="commerce-totals">SPEND ₡{state.commerce.directSpend} · REVENUE ₡{state.commerce.directRevenue} · BOUGHT {state.commerce.unitsBought} · SOLD {state.commerce.unitsSold}</div></div>;
}

function Quality({ state }: { state: GameState }) {
  const items = Object.keys(state.inventory).filter((item) => (state.inventory[item] || 0) > 0 || state.spc[item as keyof GameState['spc']]);
  return <div className="quality-screen"><div className="quality-intro"><span className="eyebrow">STATISTICAL PROCESS CONTROL</span><h2>Capability at a glance</h2><p>Cpk compares process spread with specification limits. Five samples unlock a stable capability reading; higher is better.</p></div><div className="quality-grid">{items.map((item) => { const d = capability(state, item as any); const stock = state.stockQuality[item as Item]; const cpk = d.cpk === null ? null : Number.isFinite(d.cpk) ? d.cpk : 0; const status = d.count === 0 ? 'NOT SAMPLED' : d.count < 5 ? `COLLECTING ${d.count}/5` : cpk !== null && cpk >= 1.33 ? 'CAPABLE' : 'MARGINAL'; return <article className="quality-card" key={item}><div><span className="eyebrow">{names[item] || item}</span><h3>{state.inventory[item] || 0} UNITS</h3></div><div className="quality-metrics"><span>AVG GRADE <b>{stock?.average?.toFixed(1) || '—'}</b></span><span>SAMPLES <b>{d.count}</b></span><span>MEAN <b>{d.count ? d.mean.toFixed(1) : '—'}</b></span><span>SIGMA <b>{d.count ? d.standardDeviation.toFixed(2) : '—'}</b></span><span>CPK <b>{cpk === null ? '—' : cpk.toFixed(2)}</b></span></div><div className={`quality-status ${status === 'CAPABLE' ? 'good' : status === 'MARGINAL' ? 'warn' : ''}`}>{status}</div></article>; })}</div><div className="quality-progression"><h3>QUALITY PROGRESSION</h3><p>Improve Cpk with Quality, SPC Fundamentals, Metrology, Process Capability and CNC research. Idle CMM benches do not inflate capability; inspection improves produced measurement confidence.</p><div className="progress-track"><span style={{ width: `${Math.min(100, state.quality)}%` }} /></div></div></div>;
}

function Guide() {
  return <div className="guide"><h2>THE STARTER CAMPAIGN</h2><ol><li>Choose Powered Drill and click the FE iron deposit.</li><li>Place an Arc Furnace on any free cell. Without a connected belt, machine output goes into shared stock automatically.</li><li>Wait for 8 steel, open Contracts and ship C-101.</li><li>Open Research and buy Quality for ₡300.</li><li>Place the coal drill and a lathe to make high-quality shafts, then ship C-202.</li><li>To automate logistics, rotate a machine toward the first conveyor. Each belt follows its own direction and can turn a route into a Stock Rack or Shipping Dock.</li><li>Crates are real stock: racks unload them into inventory, while docks unload and automatically dispatch the first eligible contract.</li></ol><h2>EXPANDING THE FACTORY</h2><p>Research unlocks faster belts, gear cutting, assemblers, metrology and advanced contracts. Locked shop tools show the required research. Gears are produced after Gear Cutting when the gear contract is active; assemblers combine gears and copper into precision assemblies. Autosave uses this browser's local storage.</p></div>;
}

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);
