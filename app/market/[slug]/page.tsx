'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { useAuth } from '@/context/AuthContext';
import { buyShares, sellShares, getHoldings } from '@/lib/demoPortfolio'; // ✅ correct path & top import

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
  const { token, user } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [side, setSide] = useState<string>('YES');
  const [quantity, setQuantity] = useState(10);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState('');

  const countdown = useCountdown(market?.endDate);

  // Fetch market and refresh every 15s
  useEffect(() => {
    fetchMarket();
    const interval = setInterval(fetchMarket, 15000);
    return () => clearInterval(interval);
  }, [params.slug]);

  const fetchMarket = async () => {
    try {
      const res = await fetch(`/api/markets/${params.slug}`);
      const data = await res.json();
      if (data.success) {
        const m = data.market;
        const outcomes =
          m.outcomes ||
          (m.outcomePrices
            ? [
                { label: 'YES', price: parseFloat(m.outcomePrices[0]) },
                { label: 'NO', price: parseFloat(m.outcomePrices[1]) },
              ]
            : []);
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
      console.error(error);
      setLoading(false);
    }
  };

  // ✅ FIXED: Safe placeOrder function with ownership logic
  const placeOrder = async () => {
    if (!user) {
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

    const holdings = getHoldings(market.id);
    const userHolding = holdings.find((h) => h.outcome === side);

    // ---- SELL CHECK ----
    if (mode === 'sell') {
      if (!userHolding || userHolding.shares < quantity) {
        setMessage('❌ You do not have enough shares to sell.');
        return;
      }
    }

    setPlacing(true);
    setMessage('');

    const selectedOutcome =
      market.outcomes.find((o) => o.label === side) || market.outcomes[0];
    const price = selectedOutcome.price;
    const total = price * quantity;

    // ---- Local portfolio logic ----
    if (mode === 'buy') {
      buyShares(market.id, side, quantity);
      setMessage(`✅ Bought ${quantity} ${side} shares for $${total.toFixed(2)}`);
    } else {
      const ok = sellShares(market.id, side, quantity);
      if (ok) {
        setMessage(`✅ Sold ${quantity} ${side} shares for $${total.toFixed(2)}`);
      } else {
        setMessage('❌ Sell failed (not enough shares)');
      }
    }

    setQuantity(10);
    setPlacing(false);
  };

  // ✅ LOADING & EMPTY STATES
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

  return (
    <>
      <NavBar />
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto">
          {/* Market Info */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            {market.imageUrl && (
              <img
                src={market.imageUrl}
                alt={market.question}
                className="rounded-lg mb-4 w-full h-64 object-cover"
              />
            )}
            <h1 className="text-2xl font-bold mb-2">{market.question}</h1>

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

          {/* Outcomes */}
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-lg font-semibold mb-3">Outcomes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {market.outcomes.map((o) => (
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
                </div>
              ))}
            </div>
          </div>

          {/* Trade Panel */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Trade</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setMode('buy')}
                  className={`px-4 py-2 rounded font-semibold ${
                    mode === 'buy'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setMode('sell')}
                  className={`px-4 py-2 rounded font-semibold ${
                    mode === 'sell'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Sell
                </button>
              </div>
            </div>

            {!user && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-3 rounded mb-4">
                Please login to trade
              </div>
            )}

            <div className="space-y-4">
              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Quantity (shares)
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(parseInt(e.target.value) || 0)
                  }
                  className="w-full border rounded px-4 py-2"
                  min="1"
                />
              </div>

              {/* Cost Summary */}
              <div className="bg-gray-50 p-4 rounded">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Price per share:</span>
                  <span className="font-semibold">
                    ${selectedOutcome.price.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>
                    {mode === 'buy' ? 'Total Cost:' : 'Potential Return:'}
                  </span>
                  <span>${cost.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={placing || !user}
                className={`w-full py-3 rounded font-semibold ${
                  placing || !user
                    ? 'bg-gray-400 cursor-not-allowed'
                    : mode === 'buy'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
              >
                {placing
                  ? `${mode === 'buy' ? 'Buying' : 'Selling'}...`
                  : `${mode === 'buy' ? 'Buy' : 'Sell'} ${side} Shares`}
              </button>

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
        </div>
      </div>
    </>
  );
}
