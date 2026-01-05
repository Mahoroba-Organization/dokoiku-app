import { NextResponse } from 'next/server';
import { saveRoom } from '@/app/lib/kv';

export async function POST(request: Request) {
    const body = await request.json();
    const { area, budget } = body;

    try {
        const roomId = Math.random().toString(36).substring(2, 10);

        const roomData = {
            id: roomId,
            conditions: { area, budget },
            shops: [],
            votes: {}, // userId -> { shopId -> vote }
            participants: []
        };

        await saveRoom(roomId, roomData);

        return NextResponse.json({ roomId });

    } catch (error) {
        console.error('Server Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
