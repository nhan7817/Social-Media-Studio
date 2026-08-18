import { NextRequest, NextResponse } from 'next/server';
import { extractChannelVideos } from '@/lib/downloaders/channel-scraper';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { channelUrl, maxVideos } = await req.json();

    if (!channelUrl || typeof channelUrl !== 'string' || !channelUrl.trim()) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đường dẫn kênh hoặc playlist hợp lệ.' },
        { status: 400 }
      );
    }

    const limit = typeof maxVideos === 'number' && maxVideos > 0 ? maxVideos : undefined;
    const result = await extractChannelVideos(channelUrl.trim(), limit);

    if (!result.videos || result.videos.length === 0) {
      return NextResponse.json(
        { error: 'Không tìm thấy video nào từ kênh hoặc liên kết này.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      channelTitle: result.channelTitle,
      channelUrl: result.channelUrl,
      totalFound: result.totalFound,
      videos: result.videos,
    });
  } catch (error: any) {
    console.error('Channel extract error:', error);
    return NextResponse.json(
      { error: error.message || 'Lỗi trong quá trình quét kênh.' },
      { status: 500 }
    );
  }
}
