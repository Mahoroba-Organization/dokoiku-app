'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';



export default function Home() {
  const router = useRouter();
  const [area, setArea] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const minValue = budgetMin ? Number(budgetMin) : undefined;
      const maxValue = budgetMax ? Number(budgetMax) : undefined;

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, budgetMin: minValue, budgetMax: maxValue }),
      });

      if (!res.ok) {
        throw new Error('Failed to create room');
      }

      const data = await res.json();
      router.push(`/room/${data.roomId}/join`);
    } catch (error) {
      console.error(error);
      alert('エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <main className="flex flex-col items-center space-y-8 max-w-md w-full">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            どこ行く？🍽
          </h1>
          <p className="text-lg text-gray-600">
            みんなの「気分」で<br />
            不満が出ないお店を決めよう
          </p>
        </div>

        <div className="w-full bg-white p-6 rounded-xl shadow-lg space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">エリア</label>
            <div className="relative">
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="例：渋谷、新宿"
                className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">予算 (円)</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="下限"
                className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="上限"
                className="block w-full rounded-lg border-gray-300 bg-gray-50 p-3 text-gray-900 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className={`w-full text-white font-bold py-4 px-6 rounded-xl shadow-md transition-all transform active:scale-95 text-lg
              ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg'}`}
          >
            {loading ? '準備中...' : '候補を取得する'}
          </button>
        </div>

        <div className="text-sm text-gray-400 text-center">
          <p>幹事さんが条件を決めて、</p>
          <p>みんなにURLをシェアするだけ！</p>
        </div>
      </main>
    </div>
  );
}
