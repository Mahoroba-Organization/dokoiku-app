import { NextResponse } from 'next/server';
import { rooms } from '@/app/lib/store';

const HOTPEPPER_API_ENDPOINT = 'http://webservice.recruit.co.jp/hotpepper/gourmet/v1/';

export async function POST(request: Request) {
    const body = await request.json();
    const { area, budget } = body;

    const apiKey = process.env.HOTPEPPER_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    // Simple budget mapping (approximate)
    // This is a simplification. Ideally, we'd map specific budget ranges to codes.
    // For now, we'll just use the area keyword.

    const params = new URLSearchParams({
        key: apiKey,
        keyword: area,
        format: 'json',
        count: '20', // Get top 20 results
        // budget: budgetCode // omitted for simplicity in this iteration
    });

    try {
        const response = await fetch(`${HOTPEPPER_API_ENDPOINT}?${params.toString()}`);
        const data = await response.json();

        if (!data.results || !data.results.shop) {
            console.error('Hotpepper API Error:', data);
            return NextResponse.json({ error: 'Failed to fetch restaurants' }, { status: 500 });
        }

        const shops = data.results.shop;
        const roomId = Math.random().toString(36).substring(2, 10);

        rooms[roomId] = {
            id: roomId,
            conditions: { area, budget },
            shops: shops,
            votes: {}, // userId -> { shopId -> vote }
            participants: []
        };

        return NextResponse.json({ roomId });

    } catch (error) {
        console.error('Server Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
