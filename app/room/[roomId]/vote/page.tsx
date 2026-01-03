'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VotePage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();
    const [shops, setShops] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');
    const [votes, setVotes] = useState<Record<string, number>>({});
    const [currentIndex, setCurrentIndex] = useState(0);

    // Slider State
    const [score, setScore] = useState(50);
    const [isDragging, setIsDragging] = useState(false);
    const sliderRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let storedUserId = localStorage.getItem('dokoiku_userId');
        if (!storedUserId) {
            storedUserId = Math.random().toString(36).substring(2);
            localStorage.setItem('dokoiku_userId', storedUserId);
        }
        setUserId(storedUserId);

        fetch(`/api/rooms/${roomId}`)
            .then(res => {
                if (!res.ok) throw new Error('Room not found');
                return res.json();
            })
            .then(data => {
                setShops(data.shops);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [roomId]);

    // Reset score when moving to next shop
    useEffect(() => {
        setScore(50);
    }, [currentIndex]);

    const handleVote = async (shopId: string, finalScore: number) => {
        setVotes(prev => ({ ...prev, [shopId]: finalScore }));

        // Advance to next shop locally with delay
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
        }, 300);

        try {
            await fetch(`/api/rooms/${roomId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, shopId, score: finalScore }),
            });
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
        if (isDragging) {
            setIsDragging(false);
            if (shops[currentIndex]) {
                handleVote(shops[currentIndex].id, score);
            }
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
        setIsDragging(false);
        if (shops[currentIndex]) {
            handleVote(shops[currentIndex].id, score);
        }
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, currentIndex, score]); // Dependencies for closure capture

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">読み込み中...</div>;
    }

    if (!shops || shops.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-gray-500">お店が見つかりません</p>
            </div>
        );
    }

    if (currentIndex >= shops.length) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm w-full space-y-6">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-2xl font-bold text-gray-900">投票完了！</h2>
                    <p className="text-gray-600">お疲れ様でした。<br />みんなの投票が終わるまでお待ちください。</p>

                    <button
                        onClick={() => router.push(`/room/${roomId}/result`)}
                        className="w-full bg-black text-white py-4 rounded-xl font-bold shadow-lg transform transition active:scale-95"
                    >
                        結果を見る
                    </button>
                </div>
            </div>
        );
    }

    const shop = shops[currentIndex];
    const progress = Math.round(((currentIndex) / shops.length) * 100);

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
                    <span className="text-sm font-medium text-blue-600">{currentIndex + 1} / {shops.length}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
            </header>

            {/* Main Card Area */}
            <main className="flex-1 flex flex-col p-4 max-w-md mx-auto w-full h-full justify-center">
                <div key={shop.id} className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 flex flex-col h-[75vh]">
                    <div className="h-2/5 bg-gray-200 relative">
                        {shop.photo?.pc?.l ? (
                            <img src={shop.photo.pc.l} alt={shop.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                            <h2 className="text-white font-bold text-2xl leading-tight shadow-sm">{shop.name}</h2>
                        </div>
                    </div>

                    <div className="flex-1 p-6 flex flex-col justify-between">
                        <div>
                            <p className="text-gray-600 text-sm mb-1">{shop.genre?.name}</p>
                            <p className="text-gray-900 font-bold mb-4">{shop.budget?.name}</p>
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
