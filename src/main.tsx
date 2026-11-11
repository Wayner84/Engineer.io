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
  campaignProgress,
  demolish,
  fulfillContract,
  load,
  newGame,
  place,
  rotate,
  save,
  tick,
  unlockResearch,
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
  precisionAssembly: 'PRECISION ASSY',
};

const deposits: Record<string, { short: string; color: string }> = {
  ironOre: { short: 'FE', color: '#9cb6c5' },
  copperOre: { short: 'CU', color: '#d9855b' },
  coal: { short: 'CO', color: '#f1c566' },
  stone: { short: 'ST', color: '#b8aa8e' },
};

type Tab = 'factory' | 'research' | 'orders' | 'help';

function App() {
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
  const [animationPhase, setAnimationPhase] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
          context.rotate(tile.kind === 'lathe' ? animationPhase : tile.kind === 'drill' ? animationPhase * 0.7 : 0);
          context.scale(pulse, pulse);
          context.fillStyle = BUILDINGS[tile.kind].color;
          context.fillRect(-cell / 2 + 7, -cell / 2 + 7, Math.max(8, cell - 14), Math.max(8, cell - 14));
          context.fillStyle = '#101820'; context.font = 'bold 9px IBM Plex Mono, monospace'; context.textAlign = 'center';
          context.fillText(tile.kind.slice(0, 4).toUpperCase(), 0, 3);
          context.restore();
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
            context.fillText(tile.cargo.item.slice(0, 3).toUpperCase(), cargoX, cargoY + 2);
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
      rotate(next, x, y);
      setNotice(`${BUILDINGS[target.kind].label} rotated${target.kind === 'conveyor' ? ` to ${beltDirection(next.grid[y][x].rot)}` : ''}.`);
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
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}>▤ CONTRACTS</button>
          <button className={tab === 'help' ? 'active' : ''} onClick={() => setTab('help')}>? FIELD GUIDE</button>
          <div className="side-bottom">
            <button onClick={() => setState((x) => ({ ...x, paused: !x.paused }))}>{state.paused ? '▶ RESUME' : 'Ⅱ PAUSE'}</button>
            <button onClick={() => setState((x) => ({ ...x, speed: x.speed === 3 ? 1 : x.speed + 1 }))}>SPEED ×{state.speed}</button>
            <button onClick={reset}>RESET SIM</button>
          </div>
        </aside>
        <main>
          <div className="topline">
            <div><span className="eyebrow">CAMPAIGN / GARAGE WORKSHOP</span><h1>{tab === 'factory' ? 'Production floor' : tab === 'research' ? 'Capability roadmap' : tab === 'orders' ? 'Active contracts' : 'Operator field guide'}</h1></div>
            <div className="kpis"><span>POWER <b className={state.power < 10 ? 'warn' : ''}>{state.power} kW</b></span><span>REPUTATION <b>{state.reputation}</b></span><span>QUALITY <b className="good">{state.quality}%</b></span></div>
          </div>

          <section className={`objective-card ${campaign.objective.complete ? 'complete' : ''}`} aria-label="Current campaign objective">
            <div><span className="eyebrow">CURRENT OBJECTIVE</span><h2>{campaign.objective.title}</h2><p>{campaign.objective.instructions}</p></div>
            <div className="objective-progress"><strong>{campaign.objective.current} / {campaign.objective.target}</strong><progress value={campaign.objective.current} max={campaign.objective.target} />{actionLabel && <button onClick={objectiveAction}>{actionLabel}</button>}</div>
          </section>

          <p className="notice" role="status" aria-live="polite">{notice}</p>

          {tab === 'factory' ? (
            <>
              <div className="toolbar">
                <button aria-pressed={state.mode === 'select'} className={state.mode === 'select' ? 'chosen' : ''} onClick={() => setState((x) => ({ ...x, mode: 'select' }))}>SELECT / ROTATE</button>
                <button aria-pressed={state.mode === 'demolish'} className={state.mode === 'demolish' ? 'chosen danger' : ''} onClick={() => setState((x) => ({ ...x, mode: 'demolish' }))}>DEMOLISH</button>
                {(Object.keys(BUILDINGS) as BuildingKind[]).map((kind) => { const locked = !state.research.includes(BUILDINGS[kind].requiredResearch); return <button key={kind} disabled={locked} aria-pressed={state.mode === 'place' && state.selected === kind} className={state.mode === 'place' && state.selected === kind ? 'chosen' : ''} onClick={() => { setState((x) => ({ ...x, mode: 'place', selected: kind })); setNotice(`${BUILDINGS[kind].label} selected${kind === 'conveyor' ? ', facing east' : ''}. Choose a free cell${kind === 'drill' ? ' on a deposit' : ''}.`); }}>{BUILDINGS[kind].label}<small>{locked ? `REQUIRES ${BUILDINGS[kind].requiredResearch}` : `₡${BUILDINGS[kind].cost}`}</small></button>; })}
                <label>ZOOM <input aria-label="Factory zoom" type="range" min=".7" max="1.4" step=".1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
              </div>
              <div className="board"><canvas ref={canvasRef} onClick={handleCanvasClick} aria-label={`Interactive ${GRID_WIDTH} by ${GRID_HEIGHT} factory floor`} /><div className="legend"><span>{state.mode === 'place' ? 'PLACEMENT MODE' : state.mode === 'demolish' ? 'DEMOLITION MODE' : 'SELECT / ROTATE MODE'}</span><span>BELTS: 0 EAST · 1 SOUTH · 2 WEST · 3 NORTH · SELECT/ROTATE</span><span>COAL: high-contrast CO deposit · TICK {state.tick}</span></div></div>
              <section className="panels"><div><h3>STOCK CONTROL <i>LIVE</i></h3><div className="stock">{Object.entries(state.inventory).map(([key, value]) => <span key={key}><b>{names[key] || key}</b><strong>{value}</strong></span>)}</div></div><div><h3>HOW PRODUCTION WORKS</h3><p>Every active machine reads from the shared stock inventory once per tick. Drills extract their deposit, furnaces consume ore and coal, and lathes turn steel into shafts. Conveyors route real crates into racks and shipping docks; blocked belts wait safely and pause freezes movement.</p></div></section>
            </>
          ) : tab === 'research' ? <Research state={state} setState={setState} setNotice={setNotice} /> : tab === 'orders' ? <Orders state={state} setState={setState} setNotice={setNotice} /> : <Guide />}
        </main>
      </div>
    </div>
  );
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
  return <div className="research">{Object.values(RESEARCH).map((node, index) => { const unlocked = state.research.includes(node.id); const ready = node.prerequisites.every((p) => state.research.includes(p)); return <article className={unlocked ? 'unlocked' : ready ? 'available' : 'locked'} key={node.id}><div className="node">{index + 1}</div><div><h2>{node.label} {unlocked && <em>UNLOCKED</em>}</h2><p>{node.description}</p><p><b>Prerequisites:</b> {node.prerequisites.join(', ') || 'none'} · <b>Effects:</b> {node.effects.join(' ')}</p></div><button disabled={unlocked || !ready} onClick={() => purchase(node.id, node.label)}>{unlocked ? 'ACTIVE' : !ready ? 'LOCKED' : `₡${node.cost} RESEARCH`}</button></article>; })}</div>;
}

function Orders({ state, setState, setNotice }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>> }) {
  const hasDock = state.grid.some((row) => row.some((tile) => tile.kind === 'shipping'));
  function ship(id: string) {
    setState((current) => {
      const next = structuredClone(current);
      const result = fulfillContract(next, id);
      if (!result.ok) {
        const messages = { missing: 'Contract not found.', done: 'That contract is already fulfilled.', stock: 'Not enough finished stock.', quality: 'Quality is below the contract requirement.', expired: 'The contract deadline has passed.', locked: 'Research or reputation requirements are not yet met.' };
        setNotice(messages[result.reason]);
        return current;
      }
      setNotice(`${id} shipped successfully. Reward and reputation added.`);
      return next;
    });
  }
  return <div className="orders"><p className={`dock-status ${hasDock ? 'online' : ''}`}>{hasDock ? 'SHIPPING DOCK ONLINE · Belt deliveries auto-dispatch the first eligible order.' : 'NO SHIPPING DOCK · Orders can be dispatched manually; build a dock for automatic belt dispatch.'}</p>{state.contracts.map((contract) => {
    const expired = !contract.done && state.tick >= contract.deadline;
    const stock = state.inventory[contract.item] || 0;
    const researchLocked = !!contract.requiredResearch && !state.research.includes(contract.requiredResearch);
    const reputationLocked = contract.minReputation !== undefined && state.reputation < contract.minReputation;
    const locked = researchLocked || reputationLocked;
    const blocked = locked || expired || stock < contract.qty || state.quality < contract.minGrade;
    const status = contract.done ? 'FULFILLED' : locked ? 'LOCKED' : expired ? 'EXPIRED' : stock < contract.qty ? 'NEED STOCK' : state.quality < contract.minGrade ? 'NEED QUALITY' : 'READY';
    return <article className={locked ? 'locked' : contract.done ? 'unlocked' : ''} key={contract.id}><div><span className="eyebrow">{contract.id} / {status}</span><h2>{names[contract.item]} × {contract.qty}</h2><p>Stock {stock}/{contract.qty} · Minimum quality <b>{contract.minGrade}%</b> · Deadline tick {contract.deadline}</p>{locked && <p className="requirements">Requires {contract.requiredResearch || 'current research'}{contract.minReputation !== undefined ? ` · reputation ${contract.minReputation}` : ''}</p>}</div><div className="reward">₡ {contract.reward}<button disabled={contract.done || blocked} onClick={() => ship(contract.id)}>{contract.done ? 'FULFILLED' : status}</button></div></article>;
  })}</div>;
}

function Guide() {
  return <div className="guide"><h2>THE STARTER CAMPAIGN</h2><ol><li>Choose Powered Drill and click the FE iron deposit.</li><li>Place an Arc Furnace on any free cell. Without a connected belt, machine output goes into shared stock automatically.</li><li>Wait for 8 steel, open Contracts and ship C-101.</li><li>Open Research and buy Quality for ₡300.</li><li>Place the coal drill and a lathe to make high-quality shafts, then ship C-202.</li><li>To automate logistics, rotate a machine toward the first conveyor. Each belt follows its own direction and can turn a route into a Stock Rack or Shipping Dock.</li><li>Crates are real stock: racks unload them into inventory, while docks unload and automatically dispatch the first eligible contract.</li></ol><h2>EXPANDING THE FACTORY</h2><p>Research unlocks faster belts, gear cutting, assemblers, metrology and advanced contracts. Locked shop tools show the required research. Gears are produced after Gear Cutting when the gear contract is active; assemblers combine gears and copper into precision assemblies. Autosave uses this browser's local storage.</p></div>;
}

createRoot(document.getElementById('root')!).render(<App />);
