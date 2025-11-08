'use client';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useState } from 'react';

export default function NavBar({ onSearchChange }: { onSearchChange?: (q: string) => void }) {
  const { user, logout } = useAuth();
  const [query, setQuery] = useState('');
  const [timeframe, setTimeframe] = useState<'day' | 'week' | 'month'>('day');

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    onSearchChange?.(q);
  };

  return (
    <nav className="bg-gray-900 text-white p-4 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-6 items-center">
          <Link href="/" className="text-xl font-bold hover:text-blue-400">
            PolyDemo
          </Link>
          <Link href="/" className="hover:text-blue-400">
            Markets
          </Link>
          {user && (
            <Link href="/portfolio" className="hover:text-blue-400">
              Portfolio
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input
            value={query}
            onChange={handleSearch}
            placeholder="Search markets..."
            className="text-black rounded px-2 py-1 text-sm"
          />
          {/* Filter */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="text-black rounded px-2 py-1 text-sm"
          >
            <option value="day">24 h</option>
            <option value="week">7 d</option>
            <option value="month">30 d</option>
          </select>

          {user ? (
            <>
              <span className="text-sm bg-green-600 px-3 py-1 rounded">
                Balance: ${user.balance.toFixed(2)}
              </span>
              <span className="text-sm">{user.email}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-blue-400">
                Login
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
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
