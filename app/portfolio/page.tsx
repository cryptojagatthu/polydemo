'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import { useAuth } from '@/context/AuthContext';

type Position = {
  id: number;
  marketQuestion: string;
  marketSlug: string;
  side: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  totalValue: number;
};

export default function PortfolioPage() {
  const { token, user } = useAuth();
  const router = useRouter();
  const [positions, setPositions] = useState<Position[]>([]);
  const [balance, setBalance] = useState(0);
  const [totalPnl, setTotalPnl] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    fetchPortfolio();
    
    // Refresh every 20 seconds
    const interval = setInterval(fetchPortfolio, 20000);
    return () => clearInterval(interval);
  }, [token]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch('/api/portfolio', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.success) {
        setBalance(data.balance);
        setPositions(data.positions || []);
        setTotalPnl(data.totalUnrealizedPnl);
      }
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <NavBar />
        <div className="container mx-auto p-8">
          <p>Please login to view portfolio</p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="container mx-auto p-8">
          <p>Loading portfolio...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">Portfolio</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Cash Balance</div>
            <div className="text-2xl font-bold">${balance.toFixed(2)}</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Open Positions</div>
            <div className="text-2xl font-bold">{positions.length}</div>
          </div>

          <div className={`rounded-lg shadow p-6 ${
            totalPnl >= 0 ? 'bg-green-50' : 'bg-red-50'
          }`}>
            <div className="text-sm text-gray-600 mb-1">Unrealized P&L</div>
            <div className={`text-2xl font-bold ${
              totalPnl >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${totalPnl.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Positions Table */}
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="text-left p-4">Market</th>
                <th className="text-center p-4">Side</th>
                <th className="text-right p-4">Qty</th>
                <th className="text-right p-4">Avg Price</th>
                <th className="text-right p-4">Current</th>
                <th className="text-right p-4">Value</th>
                <th className="text-right p-4">P&L</th>
              </tr>
            </thead>
            <tbody>
              {positions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-gray-500">
                    No open positions. Start trading!
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div className="font-semibold">{pos.marketQuestion}</div>
                      <div className="text-xs text-gray-500">{pos.marketSlug}</div>
                    </td>
                    <td className="text-center p-4">
                      <span className={`px-3 py-1 rounded text-sm font-semibold ${
                        pos.side === 'YES'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {pos.side}
                      </span>
                    </td>
                    <td className="text-right p-4">{pos.quantity}</td>
                    <td className="text-right p-4">${pos.avgPrice.toFixed(3)}</td>
                    <td className="text-right p-4">${pos.currentPrice.toFixed(3)}</td>
                    <td className="text-right p-4 font-semibold">
                      ${pos.totalValue.toFixed(2)}
                    </td>
                    <td className={`text-right p-4 font-semibold ${
                      pos.unrealizedPnl >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${pos.unrealizedPnl.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 text-center">
          <a
            href="/"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-semibold"
          >
            Browse Markets
          </a>
        </div>
      </div>
    </>
  );
}
