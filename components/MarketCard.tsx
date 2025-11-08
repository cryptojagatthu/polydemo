'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

// ---- bookmark helpers (localStorage fallback) ----
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem('bookmarkedMarkets') || '[]'); }
  catch { return []; }
}
function toggleBookmark(id: string) {
  const set = new Set(getBookmarks());
  set.has(id) ? set.delete(id) : set.add(id);
  localStorage.setItem('bookmarkedMarkets', JSON.stringify([...set]));
  return set.has(id);
}
function isBookmarked(id: string) { return getBookmarks().includes(id); }

// ---- countdown helper ----
function useCountdown(endDate?: string) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  useEffect(() => {
    if (!endDate) return;
    const interval = setInterval(() => {
      const diff = +new Date(endDate) - Date.now();
      if (diff <= 0) {
        setTimeLeft('Closed');
        clearInterval(interval);
        return;
      }
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      setTimeLeft(`${d}d ${h}h ${m}m`);
    }, 60000);
    return () => clearInterval(interval);
  }, [endDate]);
  return timeLeft;
}

// ---- component ----
type MarketCardProps = {
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

export default function MarketCard({
  id,
  slug,
  question,
  description,
  imageUrl,
  outcomePrices,
  outcomeLabels,
  volume,
  volume24h = 0,
  volume7d = 0,
  volume30d = 0,
  endDate,
  category,
}: MarketCardProps) {
  const { user } = useAuth();
  const [bookmarked, setBookmarked] = useState<boolean>(isBookmarked(id));
  const [loading, setLoading] = useState(false);
  const countdown = useCountdown(endDate);

  const handleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      // if backend bookmark API exists, keep your fetch calls here
      toggleBookmark(id);
      setBookmarked(isBookmarked(id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Link href={`/market/${slug}`}>
      <div className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-white relative">
        <div className="relative w-full h-40 bg-gray-200">
          <img
            src={
              imageUrl ||
              `https://placehold.co/600x240?text=${encodeURIComponent(
                question.slice(0, 40)
              )}`
            }
            alt={question}
            className="w-full h-full object-cover"
          />
          {countdown && (
            <span className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
              {countdown}
            </span>
          )}
        </div>

        <div className="p-6">
          {category && (
            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
              {category}
            </span>
          )}
          <h2 className="text-xl font-semibold mb-2 line-clamp-2">{question}</h2>

          {description && (
            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
              {description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            {outcomePrices.map((price, idx) => (
              <div key={idx} className="border rounded p-2">
                <div className="text-xs text-gray-600 mb-1">
                  {outcomeLabels[idx] || `Option ${idx + 1}`}
                </div>
                <div
                  className={`text-lg font-bold ${
                    idx === 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {(price * 100).toFixed(1)}¢
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center text-sm text-gray-500 mb-3">
            <span>Vol: ${volume?.toLocaleString()}</span>
            <span>
              {endDate
                ? new Date(endDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : 'No end date'}
            </span>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            {volume24h > 0 && <div>24h: ${volume24h.toLocaleString()}</div>}
            {volume7d > 0 && <div>7d: ${volume7d.toLocaleString()}</div>}
            {volume30d > 0 && <div>30d: ${volume30d.toLocaleString()}</div>}
          </div>

          {user && (
            <button
              onClick={handleBookmark}
              disabled={loading}
              className={`mt-3 w-full py-2 px-3 rounded text-sm font-medium transition-colors ${
                bookmarked
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {loading
                ? 'Loading...'
                : bookmarked
                ? '★ Bookmarked'
                : '☆ Bookmark'}
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
