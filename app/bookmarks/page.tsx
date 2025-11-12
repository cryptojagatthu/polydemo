'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavBar from '@/components/NavBar';
import MarketCard from '@/components/MarketCard';
import { useAuth } from '@/context/AuthContext';

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

export default function BookmarksPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const [bookmarkedMarkets, setBookmarkedMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }

    if (user) {
      fetchBookmarks();
    }
  }, [token, user, router]);

  const fetchBookmarks = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/bookmarks?userId=${user.id}`);
      const data = await response.json();

      if (data.success && data.bookmarks) {
        const markets = data.bookmarks.map((bookmark: any) => {
          const market = bookmark.market;
          return {
            id: market.id,
            slug: market.slug,
            question: market.question,
            description: market.description,
            imageUrl: market.imageUrl,
            outcomePrices: JSON.parse(market.outcomePricesJson),
            outcomeLabels: JSON.parse(market.outcomeLabelsJson),
            volume: market.volume || 0,
            volume24h: market.volume24h || 0,
            volume7d: market.volume7d || 0,
            volume30d: market.volume30d || 0,
            endDate: market.endDate,
            category: market.category,
          };
        });
        setBookmarkedMarkets(markets);
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <>
        <NavBar />
        <div className="container mx-auto p-8">
          <p className="text-center text-gray-600">Please login to view bookmarks</p>
        </div>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <NavBar />
        <div className="container mx-auto p-8">
          <p className="text-center text-gray-600">Loading bookmarks...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <div className="container mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">★ Bookmarked Markets</h1>
          <p className="text-gray-600">
            {bookmarkedMarkets.length === 0
              ? 'No bookmarked markets yet'
              : `${bookmarkedMarkets.length} market${bookmarkedMarkets.length !== 1 ? 's' : ''} saved`}
          </p>
        </div>

        {bookmarkedMarkets.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-500 mb-6">
              <p className="text-lg mb-4">No bookmarked markets yet</p>
              <p className="text-sm">Start bookmarking markets to save them here for quick access</p>
            </div>
            <a
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-semibold transition"
            >
              Browse Markets
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarkedMarkets.map((market) => (
              <MarketCard
                key={market.id}
                {...market}
                isBookmarked={true}
                onBookmarkChange={fetchBookmarks}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
