import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BUILDINGS,
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
  coal: { short: 'CO', color: '#697681' },
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
    localStorage.setItem('engineer-save', save(state));
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * ratio);
    canvas.height = Math.floor(canvas.clientHeight * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const cell = Math.min(canvas.clientWidth / 18, canvas.clientHeight / 12) * zoom;
    context.fillStyle = '#0c1117';
    context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 18; x++) {
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
        if (tile.kind) {
          context.fillStyle = BUILDINGS[tile.kind].color;
          context.fillRect(px + 7, py + 7, Math.max(8, cell - 14), Math.max(8, cell - 14));
          context.fillStyle = '#101820';
          context.font = 'bold 9px IBM Plex Mono, monospace';
          context.fillText(tile.kind.slice(0, 4).toUpperCase(), px + 9, py + cell / 2 + 3);
          if (tile.rot) context.fillText('↻'.repeat(tile.rot), px + 9, py + cell - 9);
        }
      }
    }
  }, [state, zoom]);

  function handleCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cell = Math.min(rect.width / 18, rect.height / 12) * zoom;
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
        setNotice(`${building.label} installed at ${x + 1}, ${y + 1}.`);
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
      setNotice(`${BUILDINGS[target.kind].label} rotated.`);
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
                {(Object.keys(BUILDINGS) as BuildingKind[]).map((kind) => <button key={kind} aria-pressed={state.mode === 'place' && state.selected === kind} className={state.mode === 'place' && state.selected === kind ? 'chosen' : ''} onClick={() => { setState((x) => ({ ...x, mode: 'place', selected: kind })); setNotice(`${BUILDINGS[kind].label} selected. Choose a free cell${kind === 'drill' ? ' on a deposit' : ''}.`); }}>{BUILDINGS[kind].label}<small>₡{BUILDINGS[kind].cost}</small></button>)}
                <label>ZOOM <input aria-label="Factory zoom" type="range" min=".7" max="1.4" step=".1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
              </div>
              <div className="board"><canvas ref={canvasRef} onClick={handleCanvasClick} aria-label="Interactive 18 by 12 factory floor" /><div className="legend"><span>{state.mode === 'place' ? 'PLACEMENT MODE' : state.mode === 'demolish' ? 'DEMOLITION MODE' : 'SELECT MODE'}</span><span>FE IRON · CU COPPER · CO COAL · ST STONE</span><span>TICK {state.tick}</span></div></div>
              <section className="panels"><div><h3>STOCK CONTROL <i>LIVE</i></h3><div className="stock">{Object.entries(state.inventory).map(([key, value]) => <span key={key}><b>{names[key] || key}</b><strong>{value}</strong></span>)}</div></div><div><h3>HOW PRODUCTION WORKS</h3><p>Every active machine reads from the shared stock inventory once per tick. Drills extract their deposit, furnaces consume ore and coal, and lathes turn steel into shafts. Conveyors are visual planning tools in this base build; routed logistics are a later milestone.</p></div></section>
            </>
          ) : tab === 'research' ? <Research state={state} setState={setState} setNotice={setNotice} /> : tab === 'orders' ? <Orders state={state} setState={setState} setNotice={setNotice} /> : <Guide />}
        </main>
      </div>
    </div>
  );
}

function Research({ state, setState, setNotice }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>> }) {
  const rows = [
    ['workshop', 'WORKSHOP', 'Hand tools, storage racks and manual machining'],
    ['production', 'PRODUCTION', 'Furnaces, alloy control and casting recipes'],
    ['quality', 'QUALITY', 'Process improvement, sampling and metrology'],
    ['automation', 'AUTOMATION', 'Belts, inserters and robotic cells'],
    ['materials', 'MATERIALS', 'Tool steel, copper alloys and precision stock'],
  ];
  function purchase(id: string, title: string) {
    setState((current) => {
      const result = unlockResearch(current, id);
      if (!result.ok) {
        setNotice(result.reason === 'insufficient-credits' ? `Not enough credits for ${title}. Research costs ₡300.` : result.reason === 'already-unlocked' ? `${title} is already unlocked.` : 'Unknown research node.');
        return current;
      }
      setNotice(`${title} research unlocked.`);
      return result.state;
    });
  }
  return <div className="research">{rows.map(([id, title, description], index) => { const unlocked = state.research.includes(id); return <article className={unlocked ? 'unlocked' : ''} key={id}><div className="node">{index + 1}</div><div><h2>{title} {unlocked && <em>UNLOCKED</em>}</h2><p>{description}</p></div><button disabled={unlocked} onClick={() => purchase(id, title)}>{unlocked ? 'ACTIVE' : state.credits < 300 ? 'NEED ₡300' : '₡300 RESEARCH'}</button></article>; })}</div>;
}

function Orders({ state, setState, setNotice }: { state: GameState; setState: React.Dispatch<React.SetStateAction<GameState>>; setNotice: React.Dispatch<React.SetStateAction<string>> }) {
  function ship(id: string) {
    setState((current) => {
      const next = structuredClone(current);
      const result = fulfillContract(next, id);
      if (!result.ok) {
        const messages = { missing: 'Contract not found.', done: 'That contract is already fulfilled.', stock: 'Not enough finished stock.', quality: 'Quality is below the contract requirement.', expired: 'The contract deadline has passed.' };
        setNotice(messages[result.reason]);
        return current;
      }
      setNotice(`${id} shipped successfully. Reward and reputation added.`);
      return next;
    });
  }
  return <div className="orders">{state.contracts.map((contract) => { const expired = !contract.done && state.tick >= contract.deadline; const stock = state.inventory[contract.item] || 0; const blocked = expired || stock < contract.qty || state.quality < contract.minGrade; return <article key={contract.id}><div><span className="eyebrow">{contract.id} / DELIVERY ORDER</span><h2>{names[contract.item]} × {contract.qty}</h2><p>Stock {stock}/{contract.qty} · Minimum quality <b>{contract.minGrade}%</b> · Deadline tick {contract.deadline} {expired && <b>· EXPIRED</b>}</p></div><div className="reward">₡ {contract.reward}<button disabled={contract.done || blocked} onClick={() => ship(contract.id)}>{contract.done ? 'FULFILLED' : expired ? 'EXPIRED' : 'SHIP ORDER'}</button></div></article>; })}</div>;
}

function Guide() {
  return <div className="guide"><h2>THE STARTER CAMPAIGN</h2><ol><li>Choose Powered Drill and click the FE iron deposit.</li><li>Place an Arc Furnace on any free cell. Machines process the shared stock once each tick.</li><li>Wait for 8 steel, open Contracts and ship C-101.</li><li>Open Research and buy Quality for ₡300.</li><li>Place a Manual Lathe and a drill on the CO coal deposit. Produce shafts until quality reaches 78%.</li><li>Ship C-202 to complete the starter loop.</li></ol><h2>BASE-BUILD LIMITS</h2><p>Conveyors, storage, CMM and shipping buildings can be placed for layout testing, but routed item movement, calibration and machine-to-machine logistics are not simulated yet. Autosave uses this browser's local storage; it does not sync between devices.</p></div>;
}

createRoot(document.getElementById('root')!).render(<App />);
