'use client';
import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';
import MarketCard from '@/components/MarketCard';
import { useAuth } from '@/context/AuthContext';

// ---------------- Types ----------------
type Market = {
  id: string;
  slug: string;
  question: string;
  description?: string;
  imageUrl?: string;
  outcomePrices: number[];
  outcomeLabels: string[];
  volume: number;
  volume24h?: number;
  volume7d?: number;
  volume30d?: number;
  endDate?: string;
  category?: string;
};

// ---------------- Component ----------------
export default function Home() {
  const { user } = useAuth();

  const [markets, setMarkets] = useState<Market[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('volume');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [category, setCategory] = useState('');
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [showBookmarks, setShowBookmarks] = useState(false);

  // ---------------- Effects ----------------
  useEffect(() => {
    fetchMarkets();
    if (user) fetchBookmarks();
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [search, sortBy, category, timeframe, showBookmarks, markets, bookmarks]);

  // ---------------- Fetch markets ----------------
  const fetchMarkets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        active: 'true',
        limit: '100',
      });
      const response = await fetch(`/api/markets?${params}`);
      const data = await response.json();
      setMarkets(data.markets || []);
    } catch (error) {
      console.error('Error fetching markets:', error);
    }
    setLoading(false);
  };

  // ---------------- Fetch bookmarks ----------------
  const fetchBookmarks = async () => {
  if (!user) return;
  try {
    const response = await fetch(`/api/bookmarks?userId=${user.id}`);
    const data = await response.json();

    // ✅ Explicitly type as Set<string>
    const bookmarkSet = new Set<string>(
      (data.bookmarks || []).map((b: any) => String(b.marketId))
    );

    setBookmarks(bookmarkSet);
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
  }
};


  // ---------------- Apply filters & sorting ----------------
  const applyFilters = () => {
    let filtered = [...markets];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q)
      );
    }

    // Category
    if (category) {
      filtered = filtered.filter(
        (m) => m.category?.toLowerCase() === category.toLowerCase()
      );
    }

    // Bookmarks
    if (showBookmarks) {
      filtered = filtered.filter((m) => bookmarks.has(m.id));
    }

    // Sort by timeframe volume
    filtered.sort((a, b) => {
      if (sortBy.startsWith('volume')) {
        let key: keyof Market =
          timeframe === 'day'
            ? 'volume24h'
            : timeframe === 'week'
            ? 'volume7d'
            : 'volume30d';
        return (b[key] || 0) - (a[key] || 0);
      }
      if (sortBy === 'endDate') {
        return (
          new Date(a.endDate || 0).getTime() -
          new Date(b.endDate || 0).getTime()
        );
      }
      return b.volume - a.volume;
    });

    setFilteredMarkets(filtered);
  };

  // ---------------- UI ----------------
  if (loading && markets.length === 0) {
    return (
      <>
        <NavBar onSearchChange={(q) => setSearch(q)} />
        <div className="container mx-auto p-8 text-center text-gray-500">
          <p>Loading markets...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar onSearchChange={(q) => setSearch(q)} />
      <div className="container mx-auto p-8">
        {/* Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold mb-1">Prediction Markets</h1>
            <p className="text-gray-600">
              Practice trading with fake money — no financial risk!
            </p>
          </div>
          <button
            onClick={() => setShowBookmarks((s) => !s)}
            className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
              showBookmarks
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {showBookmarks ? '★ Showing Bookmarks' : '☆ Show Bookmarks'}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white border rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Search</label>
              <input
                type="text"
                placeholder="Search markets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="volume">Total Volume</option>
                <option value="volume24h">24h Volume</option>
                <option value="volume7d">7d Volume</option>
                <option value="volume30d">30d Volume</option>
                <option value="endDate">Ending Soon</option>
              </select>
            </div>

            {/* Timeframe */}
            <div>
              <label className="block text-sm font-medium mb-2">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) =>
                  setTimeframe(e.target.value as 'day' | 'week' | 'month')
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="day">24h</option>
                <option value="week">7d</option>
                <option value="month">30d</option>
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">All Categories</option>
                <option value="Crypto">Crypto</option>
                <option value="Sports">Sports</option>
                <option value="Tech">Tech</option>
                <option value="Politics">Politics</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>
        </div>

        {/* Markets Grid */}
        {filteredMarkets.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            No markets found.
          </div>
        ) : (
          <>
            <div className="text-sm text-gray-500 mb-4">
              Showing {filteredMarkets.length} of {markets.length} markets
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMarkets.map((market) => (
                <MarketCard
                  key={market.id}
                  {...market}
                  isBookmarked={bookmarks.has(market.id)}
                  onBookmarkChange={fetchBookmarks}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
