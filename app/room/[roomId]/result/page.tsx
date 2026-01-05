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
        return <div className="min-h-screen flex items-center justify-center">集計中...</div>;
    }

    if (candidates.length === 0) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <div className="bg-white/90 p-8 rounded-3xl border border-[#d9e2f4] max-w-sm w-full text-center space-y-4 shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)]">
                    <p className="text-[#1c2b52] font-semibold">まだ十分な評価が集まっていません。</p>
                    <p className="text-sm text-[#6b7a99]">
                        候補店舗として表示されるには、参加者の3割以上の評価が必要です。
                    </p>
                    <Link
                        href={`/room/${roomId}/join`}
                        className="block w-full bg-[#2f66f6] text-white py-3 rounded-2xl font-bold hover:bg-[#2757e6] transition text-sm shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)]"
                    >
                        ルームに戻る
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4">
            <div className="max-w-md mx-auto">
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold text-[#2f66f6]">dokoiku</h1>
                    <p className="text-xs text-[#6b7a99] mt-2">みんなでお店を決めよう</p>
                </div>

                {isDecided && (
                    <div className="bg-white/90 border border-[#d9e2f4] px-4 py-3 rounded-2xl mb-4 text-sm text-center text-[#1c2b52] shadow-[0_18px_45px_-30px_rgba(47,102,246,0.35)]">
                        <p className="font-bold">✅ 自動決定されました！</p>
                        <p className="text-xs mt-1 text-[#6b7a99]">以下の店舗が最適と判定されました</p>
                    </div>
                )}

                {aExists && (
                    <div className="bg-white border border-[#f2d6d6] text-[#9a5f5f] px-4 py-3 rounded-2xl mb-4 text-sm">
                        <p className="font-bold">⚠️ 注意</p>
                        <p className="text-xs mt-1">
                            不満が出やすい傾向のメンバーが含まれている可能性があります。
                        </p>
                    </div>
                )}

                <div className="space-y-4">
                    {candidates.map((candidate, index) => {
                        const isWinner = isDecided && candidate.shop.id === decidedShopId;

                        return (
                            <div
                                key={candidate.shop.id}
                                className={`bg-white/90 p-4 rounded-3xl border border-[#d9e2f4] relative overflow-hidden shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)] ${isWinner
                                        ? 'ring-2 ring-[#2f66f6]'
                                        : ''
                                    }`}
                            >
                                {isWinner && (
                                    <div className="absolute top-0 right-0 bg-[#2f66f6] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                                        決定
                                    </div>
                                )}

                                <div className="mb-2">
                                    <h2 className="font-bold text-lg text-[#1c2b52]">{candidate.shop.name}</h2>
                                    <p className="text-xs text-[#6b7a99]">{candidate.shop.genre?.name}</p>
                                    <p className="text-xs text-[#6b7a99]">{candidate.shop.budget?.name}</p>
                                </div>

                                <div className="flex items-center justify-between text-sm">
                                    <div className="font-bold text-[#1c2b52]">
                                        スコア: <span className="text-xl">{candidate.avgScore.toFixed(1)}</span>
                                        {candidate.penaltyApplied && (
                                            <span className="text-xs text-[#9a5f5f] ml-1">(減点あり)</span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[#6b7a99]">
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
                        className="block w-full border border-[#2f66f6] text-[#2f66f6] py-3 rounded-2xl font-medium text-center transition text-sm bg-white"
                    >
                        ← ルームに戻る
                    </Link>
                </div>
            </div>
        </div>
    );
}
