'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function VotePage() {
    const params = useParams();
    const roomId = params.roomId as string;
    const router = useRouter();
    const [shops, setShops] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState('');
    const [votes, setVotes] = useState<Record<string, string>>({});
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // Generate a random userId if not exists
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

    const handleVote = async (shopId: string, voteType: 'super_yes' | 'like' | 'no') => {
        // Optimistic update
        setVotes(prev => ({ ...prev, [shopId]: voteType }));

        // Advance to next shop locally
        setTimeout(() => {
            setCurrentIndex(prev => prev + 1);
        }, 300); // Small delay for visual feedback

        try {
            await fetch(`/api/rooms/${roomId}/vote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, shopId, voteType }),
            });
        } catch (error) {
            console.error('Vote failed', error);
        }
    };

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

    // Completion Screen
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
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Header & Progress */}
            <header className="bg-white p-4 shadow-sm z-10">
                <div className="flex justify-between items-center mb-2">
                    <h1 className="font-bold text-gray-700">お店を選んでね</h1>
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
                <div key={shop.id} className="bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 flex flex-col h-[70vh]">
                    <div className="h-1/2 bg-gray-200 relative">
                        {shop.photo?.pc?.l ? (
                            <img src={shop.photo.pc.l} alt={shop.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
                            <h2 className="text-white font-bold text-2xl leading-tight shadow-sm">{shop.name}</h2>
                            <p className="text-white/90 text-sm mt-1">{shop.genre?.name} / {shop.budget?.name}</p>
                        </div>
                    </div>

                    <div className="flex-1 p-6 flex flex-col justify-between">
                        <div className="space-y-2">
                            <p className="text-gray-600 text-sm flex items-start">
                                <span className="mr-2">📍</span> {shop.access}
                            </p>
                            <p className="text-gray-600 text-sm flex items-start">
                                <span className="mr-2">🕒</span> {shop.open}
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mt-4">
                            <button
                                onClick={() => handleVote(shop.id, 'no')}
                                className="flex flex-col items-center justify-center p-4 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
                            >
                                <span className="text-3xl mb-1">🤔</span>
                                <span className="text-xs font-bold">なし</span>
                            </button>
                            <button
                                onClick={() => handleVote(shop.id, 'like')}
                                className="flex flex-col items-center justify-center p-4 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            >
                                <span className="text-3xl mb-1">👍</span>
                                <span className="text-xs font-bold">いいね</span>
                            </button>
                            <button
                                onClick={() => handleVote(shop.id, 'super_yes')}
                                className="flex flex-col items-center justify-center p-4 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                                <span className="text-3xl mb-1">😍</span>
                                <span className="text-xs font-bold">超アリ</span>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
