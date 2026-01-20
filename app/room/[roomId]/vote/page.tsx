'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BOO_WEIGHT, TAP_WINDOW_SECONDS, WANT_WEIGHT } from '@/app/lib/vote_constants';

type Shop = {
    id: string;
    name: string;
    photo?: { pc?: { l?: string } };
    genre?: { name?: string };
    budget?: { name?: string };
};

type ProgressState = {
    evaluated: number;
    total: number;
    isDecided: boolean;
    decidedShopId?: string;
};

export default function VotePage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();

    const [currentShop, setCurrentShop] = useState<Shop | null>(null);
    const [prefetchedShop, setPrefetchedShop] = useState<Shop | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');
    const [progress, setProgress] = useState<ProgressState>({ evaluated: 0, total: 0, isDecided: false });
    const [wantCount, setWantCount] = useState(0);
    const [booCount, setBooCount] = useState(0);
    const [timeLeft, setTimeLeft] = useState(TAP_WINDOW_SECONDS);

    const wantCountRef = useRef(0);
    const booCountRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const prefetchPromiseRef = useRef<Promise<Shop | null> | null>(null);

    const resetTapState = () => {
        setWantCount(0);
        setBooCount(0);
        wantCountRef.current = 0;
        booCountRef.current = 0;
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const startTimer = () => {
        stopTimer();
        const endsAt = Date.now() + TAP_WINDOW_SECONDS * 1000;
        setTimeLeft(TAP_WINDOW_SECONDS);
        timerRef.current = setInterval(() => {
            const remainingMs = Math.max(0, endsAt - Date.now());
            const remainingSec = Math.ceil(remainingMs / 100) / 10;
            setTimeLeft(remainingSec);
            if (remainingMs <= 0) {
                stopTimer();
                handleAutoSubmit();
            }
        }, 100);
    };

    // Initialize userId
    useEffect(() => {
        let storedUserId = localStorage.getItem('dokoiku_userId');
        if (!storedUserId) {
            storedUserId = Math.random().toString(36).substring(2);
            localStorage.setItem('dokoiku_userId', storedUserId);
        }
        setUserId(storedUserId);
    }, []);

    const prefetchNextShop = (): Promise<Shop | null> | null => {
        if (!userId || progress.isDecided) return null;
        if (prefetchPromiseRef.current) return prefetchPromiseRef.current;

        const promise = fetch(`/api/rooms/${roomId}/next-shop?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                const shop = data.shop || null;
                setPrefetchedShop(shop);
                if (data.progress) {
                    setProgress(data.progress);
                }
                return shop;
            })
            .catch(error => {
                console.error('Failed to prefetch next shop:', error);
                return null;
            })
            .finally(() => {
                prefetchPromiseRef.current = null;
            });

        prefetchPromiseRef.current = promise;
        return promise;
    };

    const fetchNextShop = async (): Promise<Shop | null> => {
        if (!userId) return null;
        setLoading(true);
        try {
            const res = await fetch(`/api/rooms/${roomId}/next-shop?userId=${userId}`);
            const data = await res.json();
            setProgress(data.progress);
            if (data.shop) {
                setCurrentShop(data.shop);
                prefetchNextShop();
                return data.shop;
            }
            setCurrentShop(null);
            return null;
        } catch (error) {
            console.error('Failed to fetch next shop:', error);
            return null;
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchNextShop();
        }
    }, [userId, roomId]);

    useEffect(() => {
        if (currentShop) {
            resetTapState();
            startTimer();
            prefetchNextShop();
        } else {
            stopTimer();
        }
        return () => {
            stopTimer();
        };
    }, [currentShop]);

    const submitVotes = async (shop: Shop, score: number) => {

        const optimisticNext = prefetchedShop;
        if (optimisticNext) {
            setCurrentShop(optimisticNext);
            setPrefetchedShop(null);
            prefetchNextShop();
        }

        try {
            const res = await fetch(`/api/rooms/${roomId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, shopId: shop.id, score }),
            });

            const data = await res.json();

            if (data.isDecided) {
                setProgress(prev => ({ ...prev, isDecided: true, decidedShopId: data.decidedShopId }));
                setCurrentShop(null);
                setPrefetchedShop(null);
                return;
            }

            if (!optimisticNext) {
                let nextShop: Shop | null = prefetchedShop;
                if (!nextShop && prefetchPromiseRef.current) {
                    nextShop = await prefetchPromiseRef.current;
                }

                if (nextShop) {
                    setCurrentShop(nextShop);
                    setPrefetchedShop(null);
                } else {
                    await fetchNextShop();
                }
            }
        } catch (error) {
            console.error('Vote failed', error);
    };

    const handleAutoSubmit = () => {
        if (!currentShop) return;
        const score = wantCountRef.current * WANT_WEIGHT - booCountRef.current * BOO_WEIGHT;
        submitVotes(currentShop, score);
    };

    const handleWantTap = () => {
        if (!currentShop || timeLeft <= 0) return;
        wantCountRef.current += 1;
        setWantCount(wantCountRef.current);
    };

    const handleBooTap = () => {
        if (!currentShop || timeLeft <= 0) return;
        booCountRef.current += 1;
        setBooCount(booCountRef.current);
    };

    if (loading && !currentShop) {
        return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
    }

    if (!currentShop) {
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

    const hasCompletedAll = progress.total > 0 && progress.evaluated >= progress.total;

    return (
        <div className="min-h-screen flex flex-col select-none">
            <header className="p-4 z-10 flex flex-col gap-2">
                <button
                    onClick={() => router.push(`/room/${roomId}/join`)}
                    className="text-xs font-semibold text-[#6b7a99] hover:text-[#1c2b52] flex items-center cursor-pointer"
                >
                    ← ルームへ
                </button>
                {hasCompletedAll && (
                    <div className="text-xs font-semibold text-[#2f66f6]">
                        30件の確認が完了しました
                    </div>
                )}
            </header>

            <main className="flex-1 flex flex-col p-4 max-w-3xl mx-auto w-full h-full justify-center gap-6">
                <div className="bg-white/90 rounded-3xl overflow-hidden border border-[#d9e2f4] shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)]">
                    <div className="h-56 bg-[#f2f5ff] relative">
                        {currentShop.photo?.pc?.l ? (
                            <img src={currentShop.photo.pc.l} alt={currentShop.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#9aa7c1]">No Image</div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                            <h2 className="text-white font-bold text-xl leading-tight shadow-sm">{currentShop.name}</h2>
                        </div>
                    </div>

                    <div className="p-5 flex flex-col gap-4">
                        <div>
                            <p className="text-[#6b7a99] text-sm">{currentShop.genre?.name}</p>
                            <p className="text-[#1c2b52] font-semibold">{currentShop.budget?.name}</p>
                        </div>

                        <div className="bg-[#f6f8ff] border border-[#d9e2f4] rounded-2xl px-4 py-3 flex items-center justify-between text-sm">
                            <span className="text-[#6b7a99]">残り時間</span>
                            <span className="font-bold text-[#2f66f6]">{timeLeft.toFixed(1)}s</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={handleWantTap}
                                disabled={timeLeft <= 0}
                                className="w-full bg-[#2f66f6] text-white py-4 rounded-2xl font-bold shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)] transform transition active:scale-95 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                行きたい
                                <span className="block text-xs font-semibold mt-1">+{wantCount}</span>
                            </button>
                            <button
                                onClick={handleBooTap}
                                disabled={timeLeft <= 0}
                                className="w-full border border-[#2f66f6] text-[#2f66f6] py-4 rounded-2xl font-bold transform transition active:scale-95 text-sm bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                ぶー
                                <span className="block text-xs font-semibold mt-1">-{booCount * BOO_WEIGHT}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
