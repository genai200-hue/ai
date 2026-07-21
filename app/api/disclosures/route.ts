/**
 * GET /api/disclosures?codes=005930,000660&period=week
 *
 * 클라이언트(브라우저)는 DART를 직접 호출할 수 없으므로(CORS·키 보안) 이 서버
 * 라우트를 통해 조회한다. 인증키는 서버 환경변수에만 존재한다.
 */
import { NextResponse } from "next/server";
import type { Period } from "@/lib/types";
import { getDisclosures } from "@/lib/disclosures";

export const dynamic = "force-dynamic";

const VALID_PERIOD: Period[] = ["today", "week", "month"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const codes = (searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^\d{6}$/.test(c));

  const periodParam = searchParams.get("period") as Period | null;
  const period: Period =
    periodParam && VALID_PERIOD.includes(periodParam) ? periodParam : "week";

  if (codes.length === 0) {
    return NextResponse.json({ items: [] });
  }

  try {
    const items = await getDisclosures(codes, period);
    return NextResponse.json({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    console.error("[/api/disclosures]", message);
    return NextResponse.json(
      { error: "공시 조회 중 오류가 발생했습니다.", detail: message },
      { status: 500 }
    );
  }
}
