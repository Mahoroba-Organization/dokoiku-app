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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <main className="flex flex-col items-center gap-8 max-w-md w-full">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-[#2f66f6]">dokoiku</h1>
          <p className="text-sm text-[#6b7a99]">みんなでお店を決めよう</p>
        </div>

        <div className="w-full bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-[#d9e2f4] space-y-6 shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)]">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#4b5a7a]">エリア</label>
            <div className="relative">
              <input
                type="text"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="例：渋谷、新宿"
                className="block w-full rounded-xl border border-[#d9e2f4] bg-white p-3 text-sm text-[#1c2b52] placeholder:text-[#9aa7c1] focus:border-[#2f66f6] focus:ring-[#2f66f6]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#4b5a7a]">予算 (円)</label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value)}
                placeholder="下限"
                className="block w-full rounded-xl border border-[#d9e2f4] bg-white p-3 text-sm text-[#1c2b52] placeholder:text-[#9aa7c1] focus:border-[#2f66f6] focus:ring-[#2f66f6]"
              />
              <input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value)}
                placeholder="上限"
                className="block w-full rounded-xl border border-[#d9e2f4] bg-white p-3 text-sm text-[#1c2b52] placeholder:text-[#9aa7c1] focus:border-[#2f66f6] focus:ring-[#2f66f6]"
              />
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={loading}
            className={`w-full font-bold py-3 px-6 rounded-2xl text-white transition-all active:scale-95 text-sm shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)]
              ${loading ? 'bg-[#9aa7c1] cursor-not-allowed' : 'bg-[#2f66f6] hover:bg-[#2757e6]'}`}
          >
            {loading ? '準備中...' : 'ルームを作成する'}
          </button>
        </div>

        <div className="text-xs text-[#9aa7c1] text-center">
          <p>ログイン不要・無料</p>
        </div>
      </main>
    </div>
  );
}
