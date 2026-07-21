#!/usr/bin/env node
/**
 * data/corp-index.json 재생성 스크립트.
 *
 * DART 기업개황 파일(corpCode.xml.zip)을 내려받아 상장사(종목코드 보유)만 추려
 * 컴팩트 JSON({c: corp_code, n: corp_name, s: stock_code})으로 저장한다.
 *
 * 사용: OPENDART_API_KEY=... node scripts/build-corp-index.mjs
 * (상장사 목록은 공개 정보이므로 결과 JSON은 커밋해도 된다.)
 */
import { inflateRawSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const key = process.env.OPENDART_API_KEY;
if (!key) {
  console.error("ERROR: OPENDART_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const url = `https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${key}`;
console.error("corpCode.xml 다운로드 중…");
const res = await fetch(url);
if (!res.ok) {
  console.error(`다운로드 실패: HTTP ${res.status}`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());

// 단일 항목 ZIP에서 로컬 헤더를 찾아 deflate 스트림을 그대로 inflate 한다.
const sig = buf.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
if (sig !== 0) {
  console.error("예상한 ZIP 형식이 아닙니다.");
  process.exit(1);
}
const nameLen = buf.readUInt16LE(26);
const extraLen = buf.readUInt16LE(28);
const dataStart = 30 + nameLen + extraLen;
const xml = inflateRawSync(buf.subarray(dataStart)).toString("utf8");

const listed = [];
const re = /<list>([\s\S]*?)<\/list>/g;
const pick = (block, tag) => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : "";
};
let m;
while ((m = re.exec(xml)) !== null) {
  const block = m[1];
  const s = pick(block, "stock_code");
  if (s && s !== " ") {
    listed.push({ c: pick(block, "corp_code"), n: pick(block, "corp_name"), s });
  }
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "corp-index.json");
writeFileSync(outPath, JSON.stringify(listed), "utf8");
console.error(`완료: 상장사 ${listed.length}개 → ${outPath}`);
