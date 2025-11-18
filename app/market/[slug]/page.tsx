'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { useAuth } from '@/context/AuthContext';

// ---- helpers ----
function useCountdown(endDate?: string) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  useEffect(() => {
    if (!endDate) return;
    const tick = () => {
      const diff = +new Date(endDate) - Date.now();
      if (diff <= 0) return setTimeLeft('Closed');
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    };
    tick();
    const i = setInterval(tick, 60000);
    return () => clearInterval(i);
  }, [endDate]);
  return timeLeft;
}

// ---- types ----
type Market = {
  id: string;
  slug: string;
  question: string;
  description?: string;
  imageUrl?: string;
  outcomes: { label: string; price: number }[];
  volume: number;
  active: boolean;
  endDate?: string;
};

export default function MarketPage() {
  const params = useParams();
  const router = useRouter();
  const { token, user, refreshUser } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);

  // trading states

  const [tradeMode, setTradeMode] = useState<'MARKET' | 'LIMIT'>('MARKET'); // new: MARKET | LIMIT
  const [mode, setMode] = useState<'buy' | 'sell'>('buy'); // buy or sell
  const [side, setSide] = useState<string>('YES');
  const [quantity, setQuantity] = useState<number>(10);
  const [limitPrice, setLimitPrice] = useState<number | ''>('');
  const [expiresOption, setExpiresOption] = useState<'1h' | '24h' | '3d' | 'never'>('never');
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState('');
  const [userHoldings, setUserHoldings] = useState<any[]>([]);
// ---- NEW: Limit Order History ----
const [orders, setOrders] = useState<any[]>([]);

const fetchOrders = async () => {
  if (!token) return;

  const res = await fetch(`/api/limit-orders/by-market/${params.slug}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json();

  if (data.success) {
    setOrders(data.orders);
  }
};

const cancelOrder = async (orderId: number) => {
  if (!token) return;

  const res = await fetch('/api/limit-orders/cancel', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId }),
  });

  const data = await res.json();
  if (data.success) {
    await fetchOrders();
    await refreshUser?.();
    setMessage("Order cancelled!");
  } else {
    setMessage(data.error || "Failed to cancel order");
  }
};


  const countdown = useCountdown(market?.endDate);

  // ------------------ FETCH FUNCTIONS ------------------

  // Fetch the market details
  const fetchMarket = async () => {
    try {
      const res = await fetch(`/api/markets/${params.slug}`);
      const data = await res.json();

      if (data.success) {
        const m = data.market;

        const outcomes =
          m.outcomes ||
          (m.outcomeLabels && m.outcomePrices
            ? JSON.parse(m.outcomeLabelsJson || '["Yes","No"]').map(
                (label: string, idx: number) => ({
                  label,
                  price: parseFloat(JSON.parse(m.outcomePricesJson)[idx]),
                })
              )
            : [
                { label: 'YES', price: parseFloat(m.outcomePrices?.[0] || '0.5') },
                { label: 'NO', price: parseFloat(m.outcomePrices?.[1] || '0.5') },
              ]);

        setMarket({
          ...m,
          outcomes,
          imageUrl:
            m.imageUrl ||
            `https://placehold.co/600x240?text=${encodeURIComponent(
              m.question.slice(0, 40)
            )}`,
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching market:', error);
      setLoading(false);
    }
  };

  // Fetch the user's holdings from backend portfolio
  const fetchHoldings = async () => {
    if (!token || !market) {
      setUserHoldings([]);
      return;
    }
    try {
      const res = await fetch('/api/portfolio', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.success && Array.isArray(data.positions)) {
        const holdings = data.positions
          .filter((pos: any) => pos.marketSlug === market.slug)
          .map((pos: any) => ({
            outcome: pos.side,
            shares: Number(pos.quantity),
          }));
        setUserHoldings(holdings);
      } else {
        setUserHoldings([]);
      }
    } catch (err) {
      console.error('Error fetching holdings:', err);
      setUserHoldings([]);
    }
  };

  // ------------------ USE EFFECTS ------------------

  // Fetch market every 15 seconds
  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.slug]);

  // Fetch holdings when market or token changes
  useEffect(() => {
    if (market && token) {
      fetchHoldings();
    } else {
      setUserHoldings([]);
    }
  }, [market, token]);
  useEffect(() => {
  if (token) fetchOrders();
}, [token, market]);


  // ------------------ Helper utils ------------------

  const computeExpiryIso = (opt: '1h' | '24h' | '3d' | 'never') => {
    if (opt === 'never') return null;
    const now = new Date();
    if (opt === '1h') now.setHours(now.getHours() + 1);
    if (opt === '24h') now.setDate(now.getDate() + 1);
    if (opt === '3d') now.setDate(now.getDate() + 3);
    return now.toISOString();
  };

  const getHoldingForSide = (s: string) => userHoldings.find((h) => h.outcome === s) || { shares: 0 };

  // ------------------ ORDER LOGIC ------------------

  // Market order (existing behavior)
  const placeMarketOrder = async () => {
    console.log('=== placeMarketOrder called ===');
    if (!user || !token) {
      setMessage('Please login to place orders');
      setTimeout(() => router.push('/login'), 2000);
      return;
    }

    if (!market) {
      setMessage('❌ Market not found');
      return;
    }

    if (quantity <= 0) {
      setMessage('Quantity must be greater than 0');
      return;
    }

    if (mode === 'sell') {
      const userHolding = getHoldingForSide(side);
      if (!userHolding || Number(userHolding.shares) < quantity) {
        setMessage('❌ You do not have enough shares to sell.');
        return;
      }
    }

    setPlacing(true);
    setMessage('');

    try {
      const selectedOutcome =
        market.outcomes.find((o) => o.label === side) || market.outcomes[0];
      const price = selectedOutcome.price;
      const total = price * quantity;

      const payload = {
        marketSlug: market.slug,
        side: side,
        quantity: parseInt(quantity.toString()),
      };

      console.log('Market order payload:', payload);

      const endpoint = mode === 'buy' ? '/api/orders' : '/api/sell';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Market order response:', data);

      if (data.success) {
        setMessage(
          `✅ ${mode === 'buy' ? 'Bought' : 'Sold'} ${quantity} ${side} shares for $${total.toFixed(2)}`
        );
        try { await refreshUser?.(); } catch (e) { console.warn('refreshUser failed:', e); }
        await fetchHoldings();
        setQuantity(10);
      } else {
        setMessage(`❌ ${data.error || 'Order failed'}`);
      }
    } catch (error) {
      console.error('Error placing market order:', error);
      setMessage(`❌ Error: ${String(error)}`);
    }

    setPlacing(false);
  };

  // Limit order (new)
  const placeLimitOrder = async () => {
    console.log('=== placeLimitOrder called ===');
    if (!user || !token) {
      setMessage('Please login to place orders');
      setTimeout(() => router.push('/login'), 2000);
      return;
    }

    if (!market) {
      setMessage('❌ Market not found');
      return;
    }

    if (quantity <= 0) {
      setMessage('Quantity must be greater than 0');
      return;
    }

    if (limitPrice === '' || Number(limitPrice) <= 0 || isNaN(Number(limitPrice))) {
      setMessage('❌ Provide a valid limit price');
      return;
    }

    // For SELL limit, ensure user has shares to sell
    if (mode === 'sell') {
      const userHolding = getHoldingForSide(side);
      if (!userHolding || Number(userHolding.shares) < quantity) {
        setMessage('❌ You do not have enough shares to place a sell limit order.');
        return;
      }
    }

    setPlacing(true);
    setMessage('');

    try {
      const payload = {
        marketSlug: market.slug,
        side: side,
        action: mode === 'buy' ? 'BUY' : 'SELL',
        quantity: Number(quantity),
        limitPrice: Number(limitPrice),
        expiresAt: computeExpiryIso(expiresOption), // null or ISO
      };

      console.log('Limit order payload:', payload);

      const response = await fetch('/api/limit-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log('Limit order response:', data);

      if (data.success) {
        setMessage(`✅ Limit order placed (${mode === 'buy' ? 'BUY' : 'SELL'}) — ${quantity} @ ${Number(limitPrice).toFixed(3)}`);
        try { await refreshUser?.(); } catch (e) { console.warn('refreshUser failed:', e); }
        await fetchHoldings();
        // reset form
        setQuantity(10);
        setLimitPrice('');
        setExpiresOption('never');
      } else {
        setMessage(`❌ ${data.error || 'Failed to place limit order'}`);
      }
    } catch (err) {
      console.error('Error placing limit order:', err);
      setMessage(`❌ Error: ${String(err)}`);
    }

    setPlacing(false);
  };

  // Single entrypoint called by UI
  const onSubmitOrder = async () => {
    if (tradeMode === 'MARKET') {
      await placeMarketOrder();
    } else {
      await placeLimitOrder();
    }
  };

  // ------------------ UI ------------------

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="container mx-auto p-8">
          <p>Loading market...</p>
        </div>
      </>
    );
  }

  if (!market) {
    return (
      <>
        <NavBar />
        <div className="container mx-auto p-8">
          <p>Market not found</p>
        </div>
      </>
    );
  }

  const selectedOutcome =
    market.outcomes.find((o) => o.label === side) || market.outcomes[0];
  const cost = selectedOutcome.price * quantity;
  const userHoldingForSide = getHoldingForSide(side);

  return (
    <>
      <NavBar />
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto">
          {/* ---------------- Market Info ---------------- */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            {market.imageUrl && (
              <img
                src={market.imageUrl}
                alt={market.question}
                className="rounded-lg mb-4 w-full h-64 object-cover"
              />
            )}
            <h1 className="text-2xl font-bold mb-2">{market.question}</h1>

            {market.description && (
              <p className="text-gray-600 mb-4">{market.description}</p>
            )}

            <div className="text-sm text-gray-500 mb-2">
              Volume: ${market.volume?.toLocaleString()}
            </div>
            {market.endDate && (
              <div className="text-sm text-gray-600">
                Ends:{' '}
                {new Date(market.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                {countdown && (
                  <span className="text-gray-700 font-semibold">
                    ({countdown})
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ---------------- Outcomes ---------------- */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3">Outcomes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {market.outcomes.map((o) => {
                const holding = userHoldings.find((h) => h.outcome === o.label);
                return (
                  <div
                    key={o.label}
                    onClick={() => setSide(o.label)}
                    className={`p-4 text-center border rounded cursor-pointer transition ${
                      side === o.label
                        ? 'bg-blue-100 border-blue-400'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-sm text-gray-600">{o.label}</div>
                    <div className="text-2xl font-bold text-blue-700">
                      {(o.price * 100).toFixed(1)}¢
                    </div>
                    {holding && holding.shares > 0 && (
                      <div className="text-xs text-green-600 mt-1">
                        You own: {holding.shares}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

         {/* ---------------- Trade Panel ---------------- */}
<div className="bg-white rounded-lg shadow-lg p-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-xl font-semibold">Trade</h2>

    {/* Trade Mode Toggle: MARKET / LIMIT */}
    <div className="flex items-center gap-2">
      <button
        onClick={() => setTradeMode('MARKET')}
        className={`px-3 py-1 rounded font-semibold transition ${
          tradeMode === 'MARKET' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'
        }`}
      >
        Market
      </button>
      <button
        onClick={() => setTradeMode('LIMIT')}
        className={`px-3 py-1 rounded font-semibold transition ${
          tradeMode === 'LIMIT' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-700'
        }`}
      >
        Limit
      </button>
    </div>
  </div>

  <div className="flex gap-2 mb-4">
    <button
      onClick={() => setMode('buy')}
      className={`px-4 py-2 rounded font-semibold w-full transition ${
        mode === 'buy'
          ? 'bg-green-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      Buy
    </button>
    <button
      onClick={() => setMode('sell')}
      className={`px-4 py-2 rounded font-semibold w-full transition ${
        mode === 'sell'
          ? 'bg-red-600 text-white'
          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
      }`}
    >
      Sell
    </button>
  </div>

  {!user && (
    <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
      Please login to trade
    </div>
  )}

  <div className="space-y-4">
    {/* Quantity Input */}
    <div>
      <label className="block text-sm font-medium mb-2">
        Quantity (shares)
      </label>
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
        className="w-full border rounded px-4 py-2"
        min="1"
      />
    </div>

    {/* If LIMIT mode, show limit price + expiry */}
    {tradeMode === 'LIMIT' && (
      <>
        <div>
          <label className="block text-sm font-medium mb-2">
            Limit Price (as decimal, e.g. 0.62 for 62¢)
          </label>
          <input
            type="number"
            step="0.001"
            min="0.01"
            max="0.99"
            value={limitPrice === '' ? '' : String(limitPrice)}
            onChange={(e) => {
              const v = e.target.value;
              setLimitPrice(v === '' ? '' : Number(v));
            }}
            className="w-full border rounded px-4 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Expiry</label>
          <select
            value={expiresOption}
            onChange={(e) => setExpiresOption(e.target.value as any)}
            className="w-full border rounded px-4 py-2"
          >
            <option value="1h">1 hour</option>
            <option value="24h">24 hours</option>
            <option value="3d">3 days</option>
            <option value="never">Never</option>
          </select>
        </div>
      </>
    )}

    {/* Cost Summary */}
    <div className="bg-gray-50 p-4 rounded">
      <div className="flex justify-between mb-2">
        <span className="text-gray-600">Price per share:</span>
        <span className="font-semibold">
          {tradeMode === 'MARKET'
            ? `$${selectedOutcome.price.toFixed(3)}`
            : limitPrice === ''
            ? '—'
            : `$${Number(limitPrice).toFixed(3)}`}
        </span>
      </div>
      <div className="flex justify-between text-lg font-bold">
        <span>
          {tradeMode === 'MARKET'
            ? mode === 'buy'
              ? 'Total Cost:'
              : 'Potential Return:'
            : 'Total (if filled):'}
        </span>
        <span>
          {tradeMode === 'MARKET'
            ? `$${cost.toFixed(2)}`
            : limitPrice === ''
            ? '—'
            : `$${(Number(limitPrice) * quantity).toFixed(2)}`}
        </span>
      </div>
    </div>

    {/* Sell warning */}
    {mode === 'sell' && (userHoldingForSide.shares ?? 0) < quantity && (
      <div className="text-sm text-red-600">
        You only have {userHoldingForSide.shares ?? 0} shares of {side}. You cannot sell more than that.
      </div>
    )}

    {/* Trade Button */}
    <button
      onClick={onSubmitOrder}
      disabled={
        placing ||
        !user ||
        quantity <= 0 ||
        (tradeMode === 'LIMIT' &&
          (limitPrice === '' || Number(limitPrice) <= 0)) ||
        (mode === 'sell' &&
          (userHoldingForSide.shares ?? 0) < quantity)
      }
      className={`w-full py-3 rounded font-semibold transition ${
        placing || !user
          ? 'bg-gray-400 cursor-not-allowed'
          : mode === 'buy'
          ? 'bg-green-600 hover:bg-green-700 text-white'
          : 'bg-red-600 hover:bg-red-700 text-white'
      }`}
    >
      {placing
        ? tradeMode === 'MARKET'
          ? mode === 'buy'
            ? 'Buying...'
            : 'Selling...'
          : mode === 'buy'
          ? 'Placing buy limit...'
          : 'Placing sell limit...'
        : tradeMode === 'MARKET'
        ? `${mode === 'buy' ? 'Buy' : 'Sell'} ${side} Shares`
        : `Place Limit ${mode === 'buy' ? 'Buy' : 'Sell'} ${side}`}
    </button>

    {/* Message */}
    {message && (
      <div
        className={`p-4 rounded ${
          message.includes('✅')
            ? 'bg-green-100 text-green-800'
            : 'bg-red-100 text-red-800'
        }`}
      >
        {message}
      </div>
    )}
  </div>
</div>

{/* 🚀🚀🚀 ORDER HISTORY ADDED BELOW THE TRADE PANEL 🚀🚀🚀 */}
<div className="bg-white rounded-lg shadow-lg p-6 mt-6">
  <h2 className="text-xl font-semibold mb-4">Your Orders</h2>

  {orders.length === 0 ? (
    <p className="text-gray-500">No orders for this market yet.</p>
  ) : (
    <div className="space-y-2">
      {orders.map((order) => (
  <div key={order.id} className="border p-4 rounded">
    <div className="font-semibold">
      {order.sideType} {order.side}
    </div>

    <div className="text-sm">
      Qty: {order.quantity} @ {order.limitPrice ?? order.fillPrice}
    </div>

    <div className="text-xs text-gray-500 mb-2">
      Status: {order.status}
    </div>

    {order.status === "OPEN" && (
      <button
        onClick={() => cancelOrder(order.id)}
        className="px-3 py-1 bg-red-600 text-white rounded text-sm"
      >
        Cancel
      </button>
    )}
  </div>
))}

    </div>
  )}
</div>
        </div>
      </div>
    </>
  );
} 