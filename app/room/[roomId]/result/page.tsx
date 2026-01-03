'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type ScoredShop = {
    id: string;
    name: string;
    photo?: { pc?: { l?: string } };
    access?: string;
    budget?: { name?: string };
    baseScore: number;
    finalScore: number;
    penaltyApplied: boolean;
    voteCount: number;
};

export default function ResultPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const [results, setResults] = useState<ScoredShop[]>([]);
    const [loading, setLoading] = useState(true);
    const [aExists, setAExists] = useState(false);

    useEffect(() => {
        fetch(`/api/rooms/${roomId}/result`)
            .then(res => {
                if (!res.ok) throw new Error('Room not found');
                return res.json();
            })
            .then(data => {
                setResults(data.results);
                setAExists(data.aAnalysis.exists);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [roomId]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">集計中...</div>;
    }

    if (results.length === 0) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">データがありません</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <h1 className="text-2xl font-bold text-center mb-6">みんなの評価結果</h1>

            {aExists && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
                    <p className="font-bold">⚠️ 注意</p>
                    <p>不満が出やすい傾向のメンバーが含まれている可能性があります。</p>
                    <p>そのメンバーが「なし」と評価した店は順位を下げています。</p>
                </div>
            )}

            <div className="space-y-4 max-w-md mx-auto">
                {results.map((shop, index) => (
                    <div key={shop.id} className={`bg-white p-4 rounded-xl shadow-md border-l-4 ${index === 0 ? 'border-yellow-400' : 'border-gray-200'} relative overflow-hidden`}>
                        {index === 0 && (
                            <div className="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">1位</div>
                        )}
                        <div className="mb-2">
                            <h2 className="font-bold text-lg">{shop.name}</h2>
                            <p className="text-xs text-gray-500">{shop.access}</p>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                            <div className="font-bold text-gray-700">
                                スコア: <span className="text-xl">{shop.finalScore.toFixed(1)}</span>
                                {shop.penaltyApplied && <span className="text-xs text-red-500 ml-1">(減点あり)</span>}
                            </div>
                            <div className="flex space-x-2 text-xs text-gray-500">
                                <span>🗳️ {shop.voteCount}票</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 text-center">
                <Link href="/" className="text-blue-600 underline text-sm">トップに戻る</Link>
            </div>
        </div>
    );
}
