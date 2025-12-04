'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HostPage() {
    const router = useRouter();
    const [area, setArea] = useState('');
    const [budget, setBudget] = useState('こだわらない');
    const [loading, setLoading] = useState(false);

    const handleCreateRoom = async () => {
        if (!area) {
            alert('エリアを入力してください');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ area, budget }),
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
        <div className="min-h-screen bg-gray-50 p-4 pb-20">
            <header className="mb-6">
                <Link href="/" className="text-gray-500 text-sm">← 戻る</Link>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">条件を決める</h1>
            </header>

            <main className="space-y-6 max-w-md mx-auto">
                <div className="bg-white p-6 rounded-xl shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">エリア</label>
                        <input
                            type="text"
                            placeholder="例：渋谷、新宿"
                            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            value={area}
                            onChange={(e) => setArea(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">予算（一人あたり）</label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-3 bg-white"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                        >
                            <option>こだわらない</option>
                            <option>~1,000円</option>
                            <option>~3,000円</option>
                            <option>~5,000円</option>
                            <option>5,000円~</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleCreateRoom}
                    disabled={loading}
                    className={`w-full text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-transform transform active:scale-95 text-lg ${loading ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {loading ? '検索中...' : '候補を取得する'}
                </button>
            </main>
        </div>
    );
}
