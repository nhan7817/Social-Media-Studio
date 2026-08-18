import type { Metadata } from "next";
import "./globals.css";
import { AntdProvider } from "@/components/providers/AntdProvider";

export const metadata: Metadata = {
  title: "OmniSocial Media Studio & Watermarker Pro",
  description:
    "Tải video và hình ảnh đa nền tảng mạng xã hội (YouTube, TikTok, Douyin, Instagram, Threads, Facebook) hàng loạt tuần tự, trích xuất âm thanh MP3 và tự động gắn watermark bản quyền.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="antialiased selection:bg-indigo-500 selection:text-white bg-[#070b14] text-slate-100">
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
