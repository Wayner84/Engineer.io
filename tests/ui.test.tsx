// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('responsive factory controls', () => {
  let root: Root;
  let host: HTMLDivElement;
  let App: React.ComponentType;

  beforeEach(async () => {
    localStorage.clear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
      get: () => vi.fn(),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D);
    const module = await import('../src/main');
    App = module.App;
    host = document.createElement('div');
    host.id = 'root';
    document.body.append(host);
    await act(async () => {
      root = createRoot(host);
      root.render(<App />);
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('collapses the machine catalogue and exposes explicit factory view controls', async () => {
    const button = [...host.querySelectorAll('button')].find((node) => node.textContent === 'COLLAPSE MACHINES');
    expect(button).toBeTruthy();
    expect(host.querySelector('.catalogue')?.hasAttribute('hidden')).toBe(false);
    await act(async () => button!.click());
    expect(host.querySelector('.catalogue')?.hasAttribute('hidden')).toBe(true);
    expect([...host.querySelectorAll('button')].map((node) => node.textContent)).toEqual(expect.arrayContaining(['FIT', '−', '+']));
  });

  it('keeps pause and speed reachable in compact factory controls', () => {
    const compact = host.querySelector('.compact-sim-controls');
    expect(compact).toBeTruthy();
    expect(compact!.textContent).toContain('PAUSE');
    expect(compact!.textContent).toContain('SPEED ×1');
  });

  it('groups contracts visibly by manufacturing sector', async () => {
    const contracts = [...host.querySelectorAll('button')].find((node) => node.textContent?.includes('CONTRACTS'))!;
    await act(async () => contracts.click());
    expect([...host.querySelectorAll('.contract-sector > h2')].map((node) => node.textContent)).toEqual([
      '▣ STANDARD COMMERCIAL',
      '✈ AEROSPACE',
      '✚ MEDICAL',
    ]);
  });

  it('purchases material and queues a visible exact-batch blueprint job', async () => {
    const store = [...host.querySelectorAll('button')].find((node) => node.textContent?.includes('STORE'))!;
    await act(async () => store.click());
    const steelOffer = [...host.querySelectorAll('.commerce-card')].find((node) => node.textContent?.includes('Aster Steel Service'))!;
    await act(async () => ([...steelOffer.querySelectorAll('button')].find((node) => node.textContent === 'BUY 1') as HTMLButtonElement).click());

    const contracts = [...host.querySelectorAll('button')].find((node) => node.textContent?.includes('CONTRACTS'))!;
    await act(async () => contracts.click());
    const blueprint = [...host.querySelectorAll('.blueprint-card')].find((node) => node.textContent?.includes('BP-SHAFT-01'))!;
    expect(blueprint.textContent).toContain('Turn shaft → Final inspection');
    await act(async () => ([...blueprint.querySelectorAll('button')].find((node) => node.textContent === 'QUEUE 5') as HTMLButtonElement).click());
    expect(host.querySelector('.work-order-queue')?.textContent).toContain('WO-0001');
    expect(host.querySelector('.work-order-queue')?.textContent).toContain('BATCH 5');
    const cancel = [...host.querySelectorAll<HTMLButtonElement>('.work-order-queue button')].find((node) => node.textContent === 'CANCEL & RELEASE')!;
    await act(async () => cancel.click());
    expect(host.querySelector('.work-order-queue')?.textContent).toContain('No batches queued.');
  });
});
