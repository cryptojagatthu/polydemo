// lib/demoPortfolio.ts

export type Position = {
  marketId: string;
  outcome: string; // YES or NO
  shares: number;
};

const STORAGE_KEY = 'demoPortfolio';

function loadPortfolio(): Position[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function savePortfolio(positions: Position[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}

export function getHoldings(marketId: string) {
  return loadPortfolio().filter((p) => p.marketId === marketId);
}

export function buyShares(marketId: string, outcome: string, qty: number) {
  const portfolio = loadPortfolio();
  const existing = portfolio.find(
    (p) => p.marketId === marketId && p.outcome === outcome
  );
  if (existing) existing.shares += qty;
  else portfolio.push({ marketId, outcome, shares: qty });
  savePortfolio(portfolio);
}

export function sellShares(marketId: string, outcome: string, qty: number) {
  const portfolio = loadPortfolio();
  const existing = portfolio.find(
    (p) => p.marketId === marketId && p.outcome === outcome
  );
  if (!existing || existing.shares < qty) return false; // not enough to sell
  existing.shares -= qty;
  if (existing.shares <= 0)
    savePortfolio(portfolio.filter((p) => p !== existing));
  else savePortfolio(portfolio);
  return true;
}
