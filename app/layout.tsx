import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "관심종목 공시",
  description: "관심종목에 올라온 공시를 핵심 수치와 함께 모아 봅니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
