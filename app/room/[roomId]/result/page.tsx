'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type CandidateShop = {
    shop: {
        id: string;
        name: string;
        photo?: { pc?: { l?: string } };
        access?: string;
        budget?: { name?: string };
        genre?: { name?: string };
    };
    avgScore: number;
    ratedCount: number;
    penaltyApplied: boolean;
};

export default function ResultPage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const [candidates, setCandidates] = useState<CandidateShop[]>([]);
    const [loading, setLoading] = useState(true);
    const [aExists, setAExists] = useState(false);
    const [isDecided, setIsDecided] = useState(false);
    const [decidedShopId, setDecidedShopId] = useState<string | undefined>();

    useEffect(() => {
        fetch(`/api/rooms/${roomId}/result`)
            .then(res => {
                if (!res.ok) throw new Error('Room not found');
                return res.json();
            })
            .then(data => {
                setCandidates(data.candidates || []);
                setAExists(data.aAnalysis.exists);
                setIsDecided(data.isDecided || false);
                setDecidedShopId(data.decidedShopId);
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

    if (candidates.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full text-center space-y-4">
                    <p className="text-gray-600">まだ十分な評価が集まっていません。</p>
                    <p className="text-sm text-gray-500">
                        候補店舗として表示されるには、参加者の3割以上の評価が必要です。
                    </p>
                    <Link
                        href={`/room/${roomId}/join`}
                        className="block w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                    >
                        ルームに戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4">
            <div className="max-w-md mx-auto">
                <h1 className="text-2xl font-bold text-center mb-2">評価結果</h1>

                {isDecided && (
                    <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4 text-sm text-center">
                        <p className="font-bold">✅ 自動決定されました！</p>
                        <p className="text-xs mt-1">以下の店舗が最適と判定されました</p>
                    </div>
                )}

                {aExists && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                        <p className="font-bold">⚠️ 注意</p>
                        <p className="text-xs mt-1">
                            不満が出やすい傾向のメンバーが含まれている可能性があります。
                            そのメンバーが低評価した店は順位を下げています。
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {candidates.map((candidate, index) => {
                        const isWinner = isDecided && candidate.shop.id === decidedShopId;

                        return (
                            <div
                                key={candidate.shop.id}
                                className={`bg-white p-4 rounded-xl shadow-md border-l-4 relative overflow-hidden ${isWinner
                                        ? 'border-green-400 ring-2 ring-green-200'
                                        : index === 0
                                            ? 'border-yellow-400'
                                            : 'border-gray-200'
                                    }`}
                            >
                                {isWinner && (
                                    <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                        決定
                                    </div>
                                )}
                                {!isWinner && index === 0 && (
                                    <div className="absolute top-0 right-0 bg-yellow-400 text-white text-xs font-bold px-2 py-1 rounded-bl-lg">
                                        1位
                                    </div>
                                )}

                                <div className="mb-2">
                                    <h2 className="font-bold text-lg">{candidate.shop.name}</h2>
                                    <p className="text-xs text-gray-500">{candidate.shop.genre?.name}</p>
                                    <p className="text-xs text-gray-500">{candidate.shop.budget?.name}</p>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="font-bold text-gray-700">
                                        スコア: <span className="text-xl">{candidate.avgScore.toFixed(1)}</span>
                                        {candidate.penaltyApplied && (
                                            <span className="text-xs text-red-500 ml-1">(減点あり)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        🗳️ {candidate.ratedCount}人が評価
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="mt-6 space-y-3">
                    <Link
                        href={`/room/${roomId}/join`}
                        className="block w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium text-center hover:bg-gray-200 transition"
                    >
                        ← ルームに戻る
                    </Link>
                </div>
            </div>
        </div>
    );
}
