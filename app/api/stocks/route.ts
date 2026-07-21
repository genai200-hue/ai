/**
 * GET /api/stocks?q=유한양행
 *
 * 관심종목 추가용 종목 검색. 전체 상장사 색인(corp-index)에서 종목명·코드로 찾는다.
 * 색인 데이터는 서버에만 두고(약 210KB) 클라이언트로는 매칭 결과만 내려보낸다
 * — 데이터 제공자 seam 원칙과 정합.
 */
import { NextResponse } from "next/server";
import { searchStocks } from "@/lib/dart/corpIndex";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ items: [] });

  const items = searchStocks(q, 8);
  return NextResponse.json({ items });
}
