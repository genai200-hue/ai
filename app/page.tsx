"use client";

/**
 * 관심종목 공시 화면 (클라이언트).
 *
 * UI·상호작용은 mock 단계와 동일하고, 데이터 접근만 서버 라우트(/api/disclosures)로
 * 바꿨다. 종목 마스터는 고정 유니버스라 클라이언트 상수를 그대로 쓰고, 공시는
 * DART 실데이터를 서버에서 받아온다. 관심종목·읽음 상태는 localStorage(ADR-0002).
 */
import { useEffect } from "react";
import { STOCK_MASTER, DEFAULT_WATCHLIST } from "@/lib/mock/stocks";
import type { Disclosure, Period, Stock, StructuredField } from "@/lib/types";

export default function Page() {
  useEffect(() => {
    const HOUR = 3600 * 1000;
    const NOW = new Date();

    const STOCK_BY_CODE: Record<string, Stock> = {};
    STOCK_MASTER.forEach((s) => {
      STOCK_BY_CODE[s.code] = s;
    });

    /* ---------- 데이터 접근 (seam) ---------- */
    async function getDisclosures(
      codes: string[],
      period: Period
    ): Promise<Disclosure[]> {
      if (codes.length === 0) return [];
      const qs = `codes=${encodeURIComponent(codes.join(","))}&period=${period}`;
      const res = await fetch(`/api/disclosures?${qs}`);
      if (!res.ok) throw new Error(`조회 실패 (${res.status})`);
      const data = (await res.json()) as { items: Disclosure[] };
      return data.items ?? [];
    }

    /* ---------- 상태 & 저장 ---------- */
    const LS_WATCH = "wds.watchlist";
    const LS_READ = "wds.readIds";
    function lsGet<T>(key: string, fb: T): T {
      try {
        const r = localStorage.getItem(key);
        return r == null ? fb : (JSON.parse(r) as T);
      } catch {
        return fb;
      }
    }
    function lsSet(key: string, v: unknown) {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* noop */
      }
    }

    let watchlist = lsGet<string[] | null>(LS_WATCH, null) as string[] | null;
    if (!Array.isArray(watchlist)) {
      watchlist = DEFAULT_WATCHLIST.slice();
      lsSet(LS_WATCH, watchlist);
    }
    const readIds = new Set<string>(lsGet<string[]>(LS_READ, []));
    const expandedIds = new Set<string>();
    let period: Period = "week";
    let view: "feed" | "byStock" = "feed";
    let searchActiveIdx = -1;
    let firstRender = true;
    let reqSeq = 0;
    let lastItems: Disclosure[] = [];

    function saveWatch() {
      lsSet(LS_WATCH, watchlist);
    }
    function saveRead() {
      lsSet(LS_READ, Array.from(readIds));
    }

    /* ---------- 유틸 ---------- */
    const ESC_MAP: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    function esc(s: unknown): string {
      return String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
    }
    function pad(n: number): string {
      return (n < 10 ? "0" : "") + n;
    }
    function submittedOf(d: Disclosure): number {
      return d.submittedMs ?? NOW.getTime() - (d.hoursAgo ?? 0) * HOUR;
    }
    function relTime(ms: number): string {
      const h = Math.floor((NOW.getTime() - ms) / HOUR);
      if (h < 1) return "방금 전";
      if (h < 24) return h + "시간 전";
      return Math.floor(h / 24) + "일 전";
    }
    function keyField(d: Disclosure): StructuredField | null {
      for (let i = 0; i < d.structured.length; i++)
        if (d.structured[i].emphasize) return d.structured[i];
      return d.structured[0] || null;
    }

    /* ---------- DOM ---------- */
    const $search = document.getElementById("searchInput") as HTMLInputElement;
    const $results = document.getElementById("searchResults") as HTMLDivElement;
    const $chips = document.getElementById("watchChips") as HTMLDivElement;
    const $periodToggle = document.getElementById("periodToggle") as HTMLDivElement;
    const $viewToggle = document.getElementById("viewToggle") as HTMLDivElement;
    const $unread = document.getElementById("unreadCount") as HTMLDivElement;
    const $content = document.getElementById("content") as HTMLElement;
    const $headerMeta = document.getElementById("headerMeta") as HTMLDivElement;

    /* ---------- 렌더 ---------- */
    function renderHeaderMeta() {
      const d = NOW;
      const stamp =
        d.getFullYear() +
        "." +
        pad(d.getMonth() + 1) +
        "." +
        pad(d.getDate()) +
        " " +
        pad(d.getHours()) +
        ":" +
        pad(d.getMinutes());
      $headerMeta.innerHTML =
        "기준 " + stamp + " · 관심 <b>" + (watchlist as string[]).length + "</b>종목";
    }

    function renderChips() {
      const wl = watchlist as string[];
      if (wl.length === 0) {
        $chips.innerHTML =
          '<span style="font-size:var(--t3);color:var(--fg-subtle)">등록된 종목이 없습니다.</span>';
        return;
      }
      $chips.innerHTML = wl
        .map((code) => {
          const s = STOCK_BY_CODE[code] || ({ name: code, code } as Stock);
          return (
            '<span class="chip"><span>' +
            esc(s.name) +
            '</span><span class="cd tnum">' +
            esc(s.code) +
            '</span><button data-remove="' +
            esc(s.code) +
            '" aria-label="' +
            esc(s.name) +
            ' 삭제" title="삭제">×</button></span>'
          );
        })
        .join("");
    }

    function currentResults(): Stock[] {
      const q = $search.value.trim().toLowerCase();
      if (!q) return [];
      const inWatch: Record<string, boolean> = {};
      (watchlist as string[]).forEach((c) => {
        inWatch[c] = true;
      });
      return STOCK_MASTER.filter((s) => {
        if (inWatch[s.code]) return false;
        return (
          s.name.toLowerCase().indexOf(q) !== -1 || s.code.indexOf(q) !== -1
        );
      }).slice(0, 8);
    }
    function renderResults() {
      if ($search.value.trim() === "") {
        $results.classList.add("hidden");
        return;
      }
      const list = currentResults();
      if (list.length === 0) {
        $results.innerHTML =
          '<div class="dd-empty">일치하는 종목이 없습니다.</div>';
        $results.classList.remove("hidden");
        return;
      }
      if (searchActiveIdx >= list.length) searchActiveIdx = list.length - 1;
      $results.innerHTML = list
        .map((s, i) => {
          return (
            '<div class="dd-item' +
            (i === searchActiveIdx ? " active" : "") +
            '" data-add="' +
            esc(s.code) +
            '"><span class="nm">' +
            esc(s.name) +
            '</span><span class="cd tnum">' +
            esc(s.code) +
            " · " +
            esc(s.market) +
            "</span>" +
            (s.inCoreUniverse ? '<span class="uni">유니버스</span>' : "") +
            "</div>"
          );
        })
        .join("");
      $results.classList.remove("hidden");
    }
    function addStock(code: string) {
      const wl = watchlist as string[];
      if (!STOCK_BY_CODE[code] || wl.indexOf(code) !== -1) {
        $search.value = "";
        $results.classList.add("hidden");
        return;
      }
      wl.push(code);
      saveWatch();
      $search.value = "";
      searchActiveIdx = -1;
      $results.classList.add("hidden");
      renderChips();
      renderHeaderMeta();
      void renderContent();
    }
    function removeStock(code: string) {
      watchlist = (watchlist as string[]).filter((c) => c !== code);
      saveWatch();
      renderChips();
      renderHeaderMeta();
      void renderContent();
    }

    function entryHtml(d: Disclosure, idx: number): string {
      const isNew = !readIds.has(d.id);
      const open = expandedIds.has(d.id);
      const kf = keyField(d);
      const ms = submittedOf(d);
      const fields = d.structured
        .map((f) => {
          return (
            '<div class="k">' +
            esc(f.label) +
            '</div><div class="v tnum' +
            (f.emphasize ? " emph" : "") +
            '">' +
            esc(f.value) +
            "</div>"
          );
        })
        .join("");
      const summ = d.aiSummary.map((l) => "<li>" + esc(l) + "</li>").join("");
      const revealStyle =
        firstRender && idx < 14
          ? ' style="animation-delay:' + idx * 30 + 'ms"'
          : "";
      const figure = kf
        ? '<div class="e-figure"><span class="fk">' +
          esc(kf.label) +
          '</span><span class="fv tnum">' +
          esc(kf.value) +
          '</span><span class="ft">' +
          esc(relTime(ms)) +
          "</span></div>"
        : '<div class="e-figure"><span class="ft">' +
          esc(relTime(ms)) +
          "</span></div>";
      return (
        '<article class="entry' +
        (open ? " open" : "") +
        (isNew ? " unread" : "") +
        (firstRender ? " reveal" : "") +
        '" data-card="' +
        esc(d.id) +
        '"' +
        revealStyle +
        '><div class="entry-row" data-toggle="' +
        esc(d.id) +
        '" role="button" tabindex="0" aria-expanded="' +
        open +
        '"><div class="e-main"><div class="e-line1"><span class="ind"></span><span class="e-name">' +
        esc(d.stockName) +
        '</span><span class="e-code tnum">' +
        esc(d.stockCode) +
        '</span><span class="e-type">' +
        esc(d.type) +
        '</span></div><h3 class="e-title">' +
        esc(d.title) +
        "</h3></div>" +
        figure +
        '</div><div class="entry-body"><div class="body-inner">' +
        (fields
          ? '<div class="sec">주요 항목</div><div class="fields">' +
            fields +
            "</div>"
          : "") +
        '<div class="sec">요약 · 자동 생성</div><ul class="summary">' +
        summ +
        '</ul><div class="e-foot"><div class="left"><span class="disc">투자권유·자문이 아닙니다</span><span class="rcpt tnum">접수번호 ' +
        esc(d.id) +
        '</span></div><a class="src-link" href="' +
        esc(d.sourceUrl) +
        '" target="_blank" rel="noopener">원문 보기 →</a></div></div></div></article>'
      );
    }

    function renderList(items: Disclosure[]) {
      const wl = watchlist as string[];
      const unread = items.filter((d) => !readIds.has(d.id)).length;
      const pLabel =
        period === "today" ? "오늘" : period === "week" ? "최근 1주" : "최근 1개월";
      $unread.innerHTML =
        pLabel +
        " " +
        items.length +
        "건" +
        (unread > 0 ? " · 신규 <b>" + unread + "</b>" : "");

      if (items.length === 0) {
        $content.innerHTML =
          '<div class="empty"><div class="t">이 기간에는 새 공시가 없습니다</div><div class="d">기간을 넓히거나 다른 종목을 추가해 보세요.</div></div>';
        return;
      }

      if (view === "feed") {
        $content.innerHTML = items.map(entryHtml).join("");
      } else {
        const byCode: Record<string, Disclosure[]> = {};
        items.forEach((d) => {
          (byCode[d.stockCode] = byCode[d.stockCode] || []).push(d);
        });
        let html = "";
        let gi = 0;
        wl.forEach((code) => {
          const g = byCode[code];
          if (!g || !g.length) return;
          const s = STOCK_BY_CODE[code] || ({ name: code, code } as Stock);
          html +=
            '<div class="grp"><span class="nm">' +
            esc(s.name) +
            '</span><span class="cd tnum">' +
            esc(s.code) +
            '</span><span class="cnt">' +
            g.length +
            "건</span></div>";
          html += g.map((d) => entryHtml(d, gi++)).join("");
        });
        $content.innerHTML = html;
      }
    }

    async function renderContent() {
      const wl = watchlist as string[];
      if (wl.length === 0) {
        $content.innerHTML =
          '<div class="empty"><div class="t">아직 등록한 관심종목이 없어요</div><div class="d">위에서 종목을 추가하면 새 공시 요약이 여기 쌓입니다.</div></div>';
        $unread.innerHTML = "";
        firstRender = false;
        return;
      }

      const mySeq = ++reqSeq;
      $content.innerHTML = '<div class="loading">공시를 불러오는 중…</div>';
      $unread.innerHTML = "";

      try {
        const items = await getDisclosures(wl, period);
        if (mySeq !== reqSeq) return; // 최신 요청만 반영
        lastItems = items;
        renderList(items);
      } catch (e) {
        if (mySeq !== reqSeq) return;
        console.error(e);
        $content.innerHTML =
          '<div class="empty"><div class="t">공시를 불러오지 못했습니다</div><div class="d">잠시 후 다시 시도하거나 기간·종목을 바꿔 보세요.</div></div>';
        $unread.innerHTML = "";
      } finally {
        if (mySeq === reqSeq) firstRender = false;
      }
    }

    function toggleCard(id: string) {
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
      } else {
        expandedIds.add(id);
        if (!readIds.has(id)) {
          readIds.add(id);
          saveRead();
        }
      }
      // 재조회 없이 캐시된 목록으로 다시 그린다.
      firstRender = false;
      renderList(lastItems);
    }
    function setActive(container: HTMLElement, value: string) {
      Array.prototype.forEach.call(
        container.querySelectorAll("button[data-value]"),
        (b: Element) => {
          b.classList.toggle("on", b.getAttribute("data-value") === value);
        }
      );
    }

    /* ---------- 이벤트 ---------- */
    const onSearchInput = () => {
      searchActiveIdx = -1;
      renderResults();
    };
    const onSearchFocus = () => {
      if ($search.value.trim()) renderResults();
    };
    const onSearchKeydown = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const list = currentResults();
      if (e.key === "ArrowDown") {
        e.preventDefault();
        searchActiveIdx = Math.min(searchActiveIdx + 1, list.length - 1);
        renderResults();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
        renderResults();
      } else if (e.key === "Enter") {
        const p = list[searchActiveIdx] || list[0];
        if (p) addStock(p.code);
      } else if (e.key === "Escape") {
        $results.classList.add("hidden");
      }
    };
    const onResultsMousedown = (e: MouseEvent) => {
      const it = (e.target as HTMLElement).closest("[data-add]");
      if (it) {
        e.preventDefault();
        addStock(it.getAttribute("data-add") as string);
      }
    };
    const onDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".search-wrap"))
        $results.classList.add("hidden");
    };
    const onChipsClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest("[data-remove]");
      if (b) removeStock(b.getAttribute("data-remove") as string);
    };
    const onPeriodClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest("button[data-value]");
      if (!b) return;
      period = b.getAttribute("data-value") as Period;
      setActive($periodToggle, period);
      void renderContent();
    };
    const onViewClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest("button[data-value]");
      if (!b) return;
      view = b.getAttribute("data-value") as "feed" | "byStock";
      setActive($viewToggle, view);
      renderList(lastItems);
    };
    const onContentClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(".src-link")) return;
      const h = (e.target as HTMLElement).closest("[data-toggle]");
      if (h) toggleCard(h.getAttribute("data-toggle") as string);
    };
    const onContentKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const h = (e.target as HTMLElement).closest("[data-toggle]");
      if (h) {
        e.preventDefault();
        toggleCard(h.getAttribute("data-toggle") as string);
      }
    };

    $search.addEventListener("input", onSearchInput);
    $search.addEventListener("focus", onSearchFocus);
    $search.addEventListener("keydown", onSearchKeydown);
    $results.addEventListener("mousedown", onResultsMousedown);
    document.addEventListener("click", onDocClick);
    $chips.addEventListener("click", onChipsClick);
    $periodToggle.addEventListener("click", onPeriodClick);
    $viewToggle.addEventListener("click", onViewClick);
    $content.addEventListener("click", onContentClick);
    $content.addEventListener("keydown", onContentKeydown);

    /* ---------- 초기화 ---------- */
    setActive($periodToggle, period);
    setActive($viewToggle, view);
    renderHeaderMeta();
    renderChips();
    void renderContent();

    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  return (
    <div className="wrap">
      <header>
        <div className="kicker">
          <span className="dot" />
          관심종목 공시
        </div>
        <h1>새 공시, 요약해서 한눈에</h1>
        <p className="sub">관심종목에 올라온 공시를 핵심 수치와 함께 모아 봅니다.</p>
        <div className="meta" id="headerMeta" />
      </header>

      <div className="search-wrap">
        <input
          id="searchInput"
          type="text"
          autoComplete="off"
          placeholder="관심종목 추가 — 종목명 또는 코드 검색"
        />
        <div id="searchResults" className="dropdown hidden" />
      </div>
      <div id="watchChips" className="chips" />

      <div className="filters">
        <div className="tabs" id="periodToggle" role="group" aria-label="조회 기간">
          <button data-value="today">오늘</button>
          <button data-value="week">1주</button>
          <button data-value="month">1개월</button>
        </div>
        <span className="divider" />
        <div className="tabs" id="viewToggle" role="group" aria-label="보기 방식">
          <button data-value="feed">최신순</button>
          <button data-value="byStock">종목별</button>
        </div>
        <div className="status" id="unreadCount" />
      </div>

      <section id="content" />

      <footer>
        <p>
          공시 요약은 DART 원문을 바탕으로 자동 생성된 정보 제공용이며, 특정 종목의
          매수·매도나 투자를 권유하는 것이 아닙니다. 투자 판단과 그 결과에 대한
          책임은 투자자 본인에게 있습니다. 원문은 각 항목의 ‘원문 보기’에서 확인하세요.
        </p>
        <p>데이터 출처: 금융감독원 전자공시시스템(DART). 디자인 언어: SEED Design 기반.</p>
      </footer>
    </div>
  );
}
