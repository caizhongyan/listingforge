// 埋点日志：写 Vercel Runtime Logs（供上线后排查 bug）
import { NextResponse } from 'next/server';

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const ip = req.headers.get('x-forwarded-for') || '-';
    const ua = req.headers.get('user-agent') || '-';
    console.log('[pp-event]', JSON.stringify({ event: body.event, data: body.data, ip, ua, t: Date.now() }));
  } catch (e) {}
  return new Response(null, { status: 204 });
}
