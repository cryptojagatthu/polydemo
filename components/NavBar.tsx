'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';

export default function NavBar({ onSearchChange }: { onSearchChange?: (q: string) => void }) {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');

  // DEV: periodically trigger price simulation so frontend can observe price changes
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    let isStopped = false;

    const callSim = async () => {
      try {
        await fetch('/api/simulate-prices');
      } catch (err) {
        console.warn('simulate-prices failed', err);
      }
    };

    // initial call
    callSim();

    const interval = setInterval(() => {
      if (!isStopped) callSim();
    }, 15000); // update every 15 sec

    return () => {
      isStopped = true;
      clearInterval(interval);
    };
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onSearchChange?.(q);
  };

  return (
    <nav className="bg-gray-900 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
        
        {/* Left Section */}
        <div className="flex gap-6 items-center">
          <Link href="/" className="text-xl font-bold hover:text-blue-400">
            PolyDemo
          </Link>
          <Link href="/" className="hover:text-blue-400">
            Markets
          </Link>

          {user && (
            <>
              <Link href="/portfolio" className="hover:text-blue-400">
                Portfolio
              </Link>
              <Link href="/bookmarks" className="hover:text-blue-400">
                ★ Bookmarks
              </Link>
            </>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Search */}
          <input
            value={query}
            onChange={handleSearch}
            placeholder="Search markets..."
            className="text-black rounded px-3 py-1 text-sm w-40"
          />

          {/* Volume Filter */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="text-black rounded px-3 py-1 text-sm"
          >
            <option value="day">24h Volume</option>
            <option value="week">7d Volume</option>
            <option value="month">30d Volume</option>
          </select>

          {/* Auth Section */}
          {user ? (
            <>
              <span className="text-sm bg-green-600 px-3 py-1 rounded">
                Balance: ${user.balance.toFixed(2)}
              </span>
              <span className="text-sm text-gray-300">{user.email}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded text-sm font-semibold transition"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link 
                href="/login" 
                className="hover:text-blue-400 text-sm font-semibold transition"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-semibold transition"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
