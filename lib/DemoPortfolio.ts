export type Position = {
  marketId: string;
  outcome: string;
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

export async function buyShares(
  marketId: string,
  outcome: string,
  qty: number,
  price: number,
  token: string
) {
  try {
    // Save locally first
    const portfolio = loadPortfolio();
    const existing = portfolio.find(
      (p) => p.marketId === marketId && p.outcome === outcome
    );
    if (existing) existing.shares += qty;
    else portfolio.push({ marketId, outcome, shares: qty });
    savePortfolio(portfolio);

    // Send to backend
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        marketId,
        side: outcome,
        quantity: qty,
        price,
        orderType: 'market',
      }),
    });

    return response.json();
  } catch (error) {
    console.error('Error buying shares:', error);
    throw error;
  }
}

export async function sellShares(
  marketId: string,
  outcome: string,
  qty: number,
  price: number,
  token: string
) {
  try {
    const portfolio = loadPortfolio();
    const existing = portfolio.find(
      (p) => p.marketId === marketId && p.outcome === outcome
    );

    if (!existing || existing.shares < qty) {
      throw new Error('Not enough shares to sell');
    }

    // Save locally first
    existing.shares -= qty;
    if (existing.shares <= 0) {
      savePortfolio(portfolio.filter((p) => p !== existing));
    } else {
      savePortfolio(portfolio);
    }

    // Send to backend
    const response = await fetch('/api/sell', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        marketId,
        side: outcome,
        quantity: qty,
        price,
      }),
    });

    return response.json();
  } catch (error) {
    console.error('Error selling shares:', error);
    throw error;
  }
}
