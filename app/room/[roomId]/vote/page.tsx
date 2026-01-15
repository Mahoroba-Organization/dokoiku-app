'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VotePage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();
    const [currentPair, setCurrentPair] = useState<[any, any, any] | null>(null);
    const [prefetchedPair, setPrefetchedPair] = useState<[any, any, any] | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');
    const [progress, setProgress] = useState({ evaluated: 0, total: 0, isDecided: false });
    const prefetchPromiseRef = useRef<Promise<[any, any, any] | null> | null>(null);

    const PREFER_SCORE = 80;
    const OTHER_SCORE = 40;
    const BOTH_WANT_SCORE = 80;
    const BOTH_MEH_SCORE = 30;
    const NG_SCORE = -1;

    // Initialize userId
    useEffect(() => {
        let storedUserId = localStorage.getItem('dokoiku_userId');
        if (!storedUserId) {
            storedUserId = Math.random().toString(36).substring(2);
            localStorage.setItem('dokoiku_userId', storedUserId);
        }
        setUserId(storedUserId);
    }, []);

    function prefetchNextPair(): Promise<[any, any, any] | null> | null {
        if (!userId || progress.isDecided) return null;
        if (prefetchPromiseRef.current) return prefetchPromiseRef.current;

        const promise = fetch(`/api/rooms/${roomId}/next-shop?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                const pair = data.pair || null;
                setPrefetchedPair(pair);
                return pair;
            })
            .catch(error => {
                console.error('Failed to prefetch next pair:', error);
                return null;
            })
            .finally(() => {
                prefetchPromiseRef.current = null;
            });

        prefetchPromiseRef.current = promise;
        return promise;
    }

    // Fetch next pair and progress
    const fetchNextPair = async (): Promise<[any, any, any] | null> => {
        if (!userId) return null;

        setLoading(true);
        try {
            const res = await fetch(`/api/rooms/${roomId}/next-shop?userId=${userId}`);
            const data = await res.json();

            setProgress(data.progress);

            if (data.pair) {
                setCurrentPair(data.pair);
                prefetchNextPair();
                return data.pair;
            } else {
                // No more shops or decided
                setCurrentPair(null);
                return null;
            }
        } catch (error) {
            console.error('Failed to fetch next pair:', error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    // Fetch initial shop when userId is ready
    useEffect(() => {
        if (userId) {
            fetchNextPair();
        }
    }, [userId, roomId]);

    useEffect(() => {
        if (currentPair) {
            prefetchNextPair();
        }
    }, [currentPair, userId, roomId]);

    const submitVotes = async (votes: Array<{ shopId: string; score: number }>) => {
        const optimisticNext = prefetchedPair;
        if (optimisticNext) {
            setCurrentPair(optimisticNext);
            setPrefetchedPair(null);
            prefetchNextPair();
        }

        try {
            const res = await fetch(`/api/rooms/${roomId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, votes }),
            });

            const data = await res.json();

            // Check if auto-decided
            if (data.isDecided) {
                setProgress(prev => ({ ...prev, isDecided: true }));
                setCurrentPair(null);
                setPrefetchedPair(null);
                return;
            }

            if (!optimisticNext) {
                let nextPair = prefetchedPair;
                if (!nextPair && prefetchPromiseRef.current) {
                    nextPair = await prefetchPromiseRef.current;
                }

                if (nextPair) {
                    setCurrentPair(nextPair);
                    setPrefetchedPair(null);
                } else {
                    fetchNextPair();
                }
            }
        } catch (error) {
            console.error('Vote failed', error);
        }
    };

    const handleBothMeh = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: BOTH_MEH_SCORE },
            { shopId: currentPair[1].id, score: BOTH_MEH_SCORE },
            { shopId: currentPair[2].id, score: BOTH_MEH_SCORE }
        ]);
    };

    const handleBothWant = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: BOTH_WANT_SCORE },
            { shopId: currentPair[1].id, score: BOTH_WANT_SCORE },
            { shopId: currentPair[2].id, score: BOTH_WANT_SCORE }
        ]);
    };

    const handlePickBest = (index: number) => {
        if (!currentPair) return;
        const votes = currentPair.map((shop, i) => ({
            shopId: shop.id,
            score: i === index ? PREFER_SCORE : OTHER_SCORE
        }));
        submitVotes(votes);
    };

    const handleNg = (index: number) => {
        if (!currentPair) return;
        const votes = currentPair.map((shop, i) => ({
            shopId: shop.id,
            score: i === index ? NG_SCORE : OTHER_SCORE
        }));
        submitVotes(votes);
    };

    if (loading && !currentPair) {
        return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
    }

    // Completion screen
    if (!currentPair) {
        const message = progress.isDecided
            ? '自動決定されました！'
            : '全ての店舗を評価しました！';

        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
                <div className="bg-white/90 p-8 rounded-3xl border border-[#d9e2f4] max-w-sm w-full space-y-6 shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)]">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-xl font-bold text-[#1c2b52]">{message}</h2>
                    <p className="text-sm text-[#6b7a99]">
                        {progress.isDecided
                            ? '最適な店舗が決定しました。結果をご確認ください。'
                            : 'みんなの投票が終わるまでお待ちください。'}
                    </p>

                    <button
                        onClick={() => router.push(`/room/${roomId}/result`)}
                        className="w-full bg-[#2f66f6] text-white py-3 rounded-2xl font-bold shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)] transform transition active:scale-95 text-sm"
                    >
                        結果を見る
                    </button>

                    <button
                        onClick={() => router.push(`/room/${roomId}/join`)}
                        className="w-full border border-[#2f66f6] text-[#2f66f6] py-3 rounded-2xl font-medium transform transition active:scale-95 text-sm"
                    >
                        ← ルームへ
                    </button>
                </div>
            </div>
        );
    }

    const shops = currentPair;
    const hasCompletedAll = progress.total > 0 && progress.evaluated >= progress.total;

    return (
        <div className="min-h-screen flex flex-col select-none">
            {/* Header */}
            <header className="p-4 z-10">
                <button
                    onClick={() => router.push(`/room/${roomId}/join`)}
                    className="text-xs font-semibold text-[#6b7a99] hover:text-[#1c2b52] flex items-center cursor-pointer"
                >
                    ← ルームへ
                </button>
                {hasCompletedAll && (
                    <div className="mt-3 text-xs font-semibold text-[#2f66f6]">
                        30件の確認が完了しました
                    </div>
                )}
            </header>

            {/* Main Card Area */}
            <main className="flex-1 flex flex-col p-4 max-w-5xl mx-auto w-full h-full justify-center">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {shops.map((shop: any, index: number) => (
                        <div
                            key={shop.id}
                            className="bg-white/90 rounded-3xl overflow-hidden border border-[#d9e2f4] flex flex-col relative shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)]"
                        >
                            <div className="h-44 bg-[#f2f5ff] relative">
                                {shop.photo?.pc?.l ? (
                                    <img src={shop.photo.pc.l} alt={shop.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[#9aa7c1]">No Image</div>
                                )}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                    <h2 className="text-white font-bold text-lg leading-tight shadow-sm">{shop.name}</h2>
                                </div>
                            </div>
                            <button
                                onClick={() => handleNg(index)}
                                className="absolute right-3 top-3 border border-[#2f66f6] bg-white text-[#2f66f6] text-xs px-2 py-1 rounded-full font-semibold shadow-sm cursor-pointer"
                            >
                                NG
                            </button>

                            <div className="flex-1 p-4 flex flex-col justify-between">
                                <div>
                                    <p className="text-[#6b7a99] text-sm mb-1">{shop.genre?.name}</p>
                                    <p className="text-[#1c2b52] font-semibold mb-4">{shop.budget?.name}</p>
                                </div>

                                <div className="space-y-2">
                                    <button
                                        onClick={() => handlePickBest(index)}
                                        className="w-full bg-[#2f66f6] text-white py-3 rounded-2xl font-bold shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)] transform transition active:scale-95 text-sm cursor-pointer"
                                    >
                                        こっちがいい
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                        onClick={handleBothMeh}
                        className="w-full border border-[#2f66f6] text-[#2f66f6] py-3 rounded-2xl font-semibold transform transition active:scale-95 text-sm bg-white cursor-pointer"
                    >
                        どっちも微妙
                    </button>
                    <button
                        onClick={handleBothWant}
                        className="w-full bg-[#2f66f6] text-white py-3 rounded-2xl font-bold shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)] transform transition active:scale-95 text-sm cursor-pointer"
                    >
                        どっちも行きたい
                    </button>
                </div>
            </main>
        </div>
    );
}
