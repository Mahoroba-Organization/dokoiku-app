import Link from 'next/link';
import ShareButton from '@/app/components/ShareButton';

export default async function JoinPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = await params;
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
            <main className="w-full max-w-md bg-white p-8 rounded-xl shadow-sm text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-6">ルームに参加</h1>
                <div className="space-y-4">
                    <Link
                        href={`/room/${roomId}/vote`}
                        className="block w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-xl shadow transition-transform transform active:scale-95 mb-4"
                    >
                        参加して投票へ
                    </Link>

                    <div className="pt-4 border-t border-gray-100">
                        <Link
                            href={`/room/${roomId}/result`}
                            className="block w-full bg-black hover:bg-gray-800 text-white font-bold py-3 px-6 rounded-xl shadow transition-transform transform active:scale-95"
                        >
                            集計を開始する
                        </Link>
                        <p className="text-center text-xs text-gray-400 mt-2">全員の投票が終わったら押してください</p>
                    </div>
                </div>
            </main>
            <div className="w-full max-w-md mt-4">
                <ShareButton />
            </div>
        </div>
    );
}
