import Link from 'next/link';
import ShareButton from '@/app/components/ShareButton';
import { getRoom } from '@/app/lib/kv';

export default async function JoinPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = await params;
    const room = await getRoom(roomId);
    const votes = room?.votes || {};
    const totalVotes = Object.values(votes).reduce((sum, userVotes) => sum + Object.keys(userVotes).length, 0);
    const hasAnyVotes = totalVotes > 0;
    const totalParticipants = Object.keys(votes).length;
    const completedCount = Object.values(votes).filter(userVotes => {
        const evaluatedCount = Object.keys(userVotes).length;
        const totalShops = room?.shops?.length || 0;
        return totalShops > 0 && evaluatedCount >= totalShops;
    }).length;
    const poolCount = room?.shops?.length || 0;
    const poolNames = (room?.shops || []).map((shop: any) => shop?.name).filter(Boolean);
    return (
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
            <div className="w-full max-w-md text-center mb-6">
                <h1 className="text-3xl font-bold text-[#2f66f6]">dokoiku</h1>
                <p className="text-xs text-[#6b7a99] mt-2">みんなでお店を決めよう</p>
            </div>
            <main className="w-full max-w-md bg-white/90 backdrop-blur-sm p-6 rounded-2xl border border-[#d9e2f4] shadow-[0_18px_45px_-30px_rgba(47,102,246,0.45)] text-center">
                <h2 className="text-lg font-semibold text-[#1c2b52] mb-5">ルームに参加</h2>
                <div className="text-xs text-[#6b7a99] mb-4">
                    投票完了 {completedCount} / {totalParticipants} 人
                </div>
                <div className="text-xs text-[#6b7a99] mb-4">
                    候補プール: {poolCount} 件
                </div>
                <div className="space-y-4">
                    <Link
                        href={`/room/${roomId}/vote`}
                        className="block w-full bg-[#2f66f6] hover:bg-[#2757e6] text-white font-bold py-3 px-6 rounded-2xl shadow-[0_14px_30px_-18px_rgba(47,102,246,0.8)] transition-transform transform active:scale-95 mb-4 text-sm"
                    >
                        参加して投票へ
                    </Link>

                    {hasAnyVotes && (
                        <div className="pt-4 border-t border-[#e3eaf7]">
                            <Link
                                href={`/room/${roomId}/result`}
                                className="block w-full border border-[#2f66f6] text-[#2f66f6] font-bold py-3 px-6 rounded-2xl transition-transform transform active:scale-95 text-sm"
                            >
                                集計を開始する
                            </Link>
                            <p className="text-center text-xs text-[#9aa7c1] mt-2">全員の投票が終わったら押してください</p>
                        </div>
                    )}
                </div>
            </main>
            <div className="w-full max-w-md mt-4">
                <ShareButton />
            </div>
            <div className="w-full max-w-md mt-6 text-xs text-[#6b7a99]">
                <p className="font-semibold mb-2">候補プール一覧（テスト用）</p>
                <div className="bg-white/80 border border-[#d9e2f4] rounded-2xl p-3 max-h-48 overflow-y-auto">
                    {poolNames.length === 0 ? (
                        <p className="text-[#9aa7c1]">候補がまだありません</p>
                    ) : (
                        <ul className="space-y-1">
                            {poolNames.map((name: string, index: number) => (
                                <li key={`${name}-${index}`}>{name}</li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
