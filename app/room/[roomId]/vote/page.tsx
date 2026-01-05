'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VotePage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();
    const [currentShop, setCurrentShop] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');
    const [progress, setProgress] = useState({ evaluated: 0, total: 0, isDecided: false });

    // Slider State
    const [score, setScore] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    // Initialize userId
    useEffect(() => {
        let storedUserId = localStorage.getItem('dokoiku_userId');
        if (!storedUserId) {
            storedUserId = Math.random().toString(36).substring(2);
            localStorage.setItem('dokoiku_userId', storedUserId);
        }
        setUserId(storedUserId);
    }, []);

    // Fetch next shop
    const fetchNextShop = async () => {
        if (!userId) return;

        setLoading(true);
        try {
            const res = await fetch(`/api/rooms/${roomId}/next-shop?userId=${userId}`);
            const data = await res.json();

            setProgress(data.progress);

            if (data.shop) {
                setCurrentShop(data.shop);
                setScore(50); // Reset score for new shop
            } else {
                // No more shops or decided
                setCurrentShop(null);
            }
        } catch (error) {
            console.error('Failed to fetch next shop:', error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch initial shop when userId is ready
    useEffect(() => {
        if (userId) {
            fetchNextShop();
        }
    }, [userId, roomId]);

    const handleVote = async (shopId: string, finalScore: number) => {
        try {
            const res = await fetch(`/api/rooms/${roomId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, shopId, score: finalScore }),
            });

            const data = await res.json();

            // Check if auto-decided
            if (data.isDecided) {
                setProgress(prev => ({ ...prev, isDecided: true }));
                setCurrentShop(null);
                return;
            }

            // Fetch next shop after short delay
            setTimeout(() => {
                fetchNextShop();
            }, 300);
        } catch (error) {
            console.error('Vote failed', error);
        }
    };

    // Slider Logic
    const updateScoreFromClientX = (clientX: number) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const width = rect.width;
        let percentage = (x / width) * 100;
        percentage = Math.max(0, Math.min(100, percentage));
        setScore(Math.round(percentage));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        updateScoreFromClientX(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            updateScoreFromClientX(e.clientX);
        }
    };

    const handleMouseUp = () => {
        if (isDragging && currentShop) {
            setIsDragging(false);
            handleVote(currentShop.id, score);
        }
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        setIsDragging(true);
        updateScoreFromClientX(e.touches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        updateScoreFromClientX(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (currentShop) {
            setIsDragging(false);
            handleVote(currentShop.id, score);
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, currentShop, score]);

    if (loading && !currentShop) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">読み込み中...</div>;
    }

    // Completion screen
    if (!currentShop) {
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
                    <span className="text-sm font-medium text-blue-600">{progress.evaluated} / {progress.total}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </header>

            {/* Main Card Area */}
            <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full h-full justify-center">
                <div key={currentShop.id} className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 flex flex-col h-[75vh]">
                    <div className="h-2/5 bg-gray-200 relative">
                        {currentShop.photo?.pc?.l ? (
                            <img src={currentShop.photo.pc.l} alt="店舗画像" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                    </div>

                    <div className="flex-1 p-6 flex flex-col justify-between">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">{currentShop.genre?.name}</p>
                            <p className="text-gray-900 font-bold mb-4">{currentShop.budget?.name}</p>
                        </div>

                        {/* Slider UI */}
                        <div className="mt-8 mb-4">
                            <div className="text-center mb-4">
                                <span className="text-4xl font-black text-blue-600">{score}</span>
                                <span className="text-sm text-gray-400 ml-1">点</span>
                            </div>

                            <div
                                className="relative w-full h-12 flex items-center touch-none cursor-pointer"
                                ref={sliderRef}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onTouchStart={handleTouchStart}
                                onTouchMove={handleTouchMove}
                                onTouchEnd={handleTouchEnd}
                            >
                                {/* Track */}
                                <div className="absolute left-0 right-0 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    {/* Colored Track based on score */}
                                    <div
                                        className={`h-full transition-colors ${score <= 25 ? 'bg-red-500' : 'bg-blue-500'}`}
                                        style={{ width: `${score}%` }}
                                    ></div>
                                </div>

                                {/* Thumb */}
                                <div
                                    className={`absolute w-8 h-8 rounded-full border-4 border-white shadow-lg transform -translate-x-1/2 transition-transform ${isDragging ? 'scale-125' : ''} ${score <= 25 ? 'bg-red-500' : 'bg-blue-600'}`}
                                    style={{ left: `${score}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                                <span>0 (なし)</span>
                                <span>50</span>
                                <span>100 (最高)</span>
                            </div>
                        </div>

                        <div className="text-center text-xs text-gray-400">
                            指を離すと決定します
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
