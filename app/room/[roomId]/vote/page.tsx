'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VotePage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();
    const [currentPair, setCurrentPair] = useState<[any, any] | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');
    const [progress, setProgress] = useState({ evaluated: 0, total: 0, isDecided: false });

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

    // Fetch next pair
    const fetchNextPair = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/rooms/${roomId}/next-shop?userId=${userId}`);
            const data = await res.json();

            setProgress(data.progress);

            if (data.pair) {
                setCurrentPair(data.pair);
            } else {
                // No more shops or decided
                setCurrentPair(null);
            }
        } catch (error) {
            console.error('Failed to fetch next pair:', error);
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

    const submitVotes = async (votes: Array<{ shopId: string; score: number }>) => {
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
                return;
            }

            // Fetch next shop after short delay
            setTimeout(() => {
                fetchNextPair();
            }, 300);
        } catch (error) {
            console.error('Vote failed', error);
        }
    };

    const handlePickLeft = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: PREFER_SCORE },
            { shopId: currentPair[1].id, score: OTHER_SCORE }
        ]);
    };

    const handlePickRight = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: OTHER_SCORE },
            { shopId: currentPair[1].id, score: PREFER_SCORE }
        ]);
    };

    const handleBothMeh = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: BOTH_MEH_SCORE },
            { shopId: currentPair[1].id, score: BOTH_MEH_SCORE }
        ]);
    };

    const handleBothWant = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: BOTH_WANT_SCORE },
            { shopId: currentPair[1].id, score: BOTH_WANT_SCORE }
        ]);
    };

    const handleNgLeft = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: NG_SCORE },
            { shopId: currentPair[1].id, score: PREFER_SCORE }
        ]);
    };

    const handleNgRight = () => {
        if (!currentPair) return;
        submitVotes([
            { shopId: currentPair[0].id, score: PREFER_SCORE },
            { shopId: currentPair[1].id, score: NG_SCORE }
        ]);
    };

    if (loading && !currentPair) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">読み込み中...</div>;
    }

    // Completion screen
    if (!currentPair) {
        const message = progress.isDecided
            ? '自動決定されました！'
            : '全ての店舗を評価しました！';

        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full space-y-6">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold text-gray-900">{message}</h2>
                    <p className="text-gray-600">
                        {progress.isDecided
                            ? '最適な店舗が決定しました。結果をご確認ください。'
                            : 'みんなの投票が終わるまでお待ちください。'}
                    </p>

                    <button
                        onClick={() => router.push(`/room/${roomId}/result`)}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg transform transition active:scale-95"
                    >
                        結果を見る
                    </button>

                    <button
                        onClick={() => router.push(`/room/${roomId}/join`)}
                        className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-medium transform transition active:scale-95"
                    >
                        ← ルームへ
                    </button>
                </div>
            </div>
        );
    }

    const progressPercent = progress.total > 0 ? Math.round((progress.evaluated / progress.total) * 100) : 0;

    const leftShop = currentPair[0];
    const rightShop = currentPair[1];

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col select-none">
            {/* Header & Progress */}
            <header className="bg-white p-4 shadow-sm z-10">
                <div className="flex justify-between items-center mb-2">
                    <button
                        onClick={() => router.push(`/room/${roomId}/join`)}
                        className="text-xs font-bold text-gray-500 hover:text-gray-900 flex items-center bg-gray-100 px-3 py-1 rounded-lg"
                    >
                        ← ルームへ
                    </button>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </header>

            {/* Main Card Area */}
            <main className="flex-1 flex flex-col p-4 max-w-3xl mx-auto w-full h-full justify-center">
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 flex flex-col relative">
                        <div className="h-44 bg-gray-200 relative">
                            {leftShop.photo?.pc?.l ? (
                                <img src={leftShop.photo.pc.l} alt={leftShop.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                <h2 className="text-white font-bold text-lg leading-tight shadow-sm">{leftShop.name}</h2>
                            </div>
                        </div>
                        <button
                            onClick={handleNgLeft}
                            className="absolute right-3 top-3 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold shadow-sm"
                        >
                            NG
                        </button>

                        <div className="flex-1 p-4 flex flex-col justify-between">
                            <div>
                                <p className="text-gray-600 text-sm mb-1">{leftShop.genre?.name}</p>
                                <p className="text-gray-900 font-bold mb-4">{leftShop.budget?.name}</p>
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={handlePickLeft}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg transform transition active:scale-95"
                                >
                                    こっちがいい
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 flex flex-col relative">
                        <div className="h-44 bg-gray-200 relative">
                            {rightShop.photo?.pc?.l ? (
                                <img src={rightShop.photo.pc.l} alt={rightShop.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                                <h2 className="text-white font-bold text-lg leading-tight shadow-sm">{rightShop.name}</h2>
                            </div>
                        </div>
                        <button
                            onClick={handleNgRight}
                            className="absolute right-3 top-3 bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold shadow-sm"
                        >
                            NG
                        </button>

                        <div className="flex-1 p-4 flex flex-col justify-between">
                            <div>
                                <p className="text-gray-600 text-sm mb-1">{rightShop.genre?.name}</p>
                                <p className="text-gray-900 font-bold mb-4">{rightShop.budget?.name}</p>
                            </div>

                            <div className="space-y-2">
                                <button
                                    onClick={handlePickRight}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg transform transition active:scale-95"
                                >
                                    こっちがいい
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                        onClick={handleBothMeh}
                        className="w-full bg-gray-200 text-gray-700 py-3 rounded-xl font-bold transform transition active:scale-95"
                    >
                        どっちも微妙
                    </button>
                    <button
                        onClick={handleBothWant}
                        className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg transform transition active:scale-95"
                    >
                        どっちも行きたい
                    </button>
                </div>
            </main>
        </div>
    );
}
