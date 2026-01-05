'use client';

import { useEffect, useState } from 'react';

export default function ShareButton() {
    const [copied, setCopied] = useState(false);
    const [url, setUrl] = useState('');

    useEffect(() => {
        setUrl(window.location.href);
    }, []);

    const handleCopy = () => {
        if (!url) return;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('URLのコピーに失敗しました');
        });
    };

    return (
        <div className="w-full rounded-2xl border border-[#d9e2f4] bg-white/80 p-4">
            <p className="text-xs font-semibold text-[#6b7a99] mb-2">ルームリンク</p>
            <div className="flex items-center gap-2">
                <div className="flex-1 rounded-xl border border-[#d9e2f4] bg-white px-3 py-2 text-xs text-[#6b7a99] truncate">
                    {url || 'URLを取得中...'}
                </div>
                <button
                    onClick={handleCopy}
                    className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold shadow-sm transition active:scale-95 ${
                        copied
                            ? 'bg-[#2f66f6] text-white'
                            : 'bg-[#2f66f6] text-white hover:bg-[#2757e6]'
                    }`}
                >
                    {copied ? 'コピー済み' : 'コピー'}
                </button>
            </div>
        </div>
    );
}
