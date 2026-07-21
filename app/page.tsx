"use client";

/**
 * 관심종목 공시 화면 (클라이언트).
 *
 * 종목 검색은 전체 상장사 색인을 가진 서버 라우트(/api/stocks)로 조회하고, 공시는
 * /api/disclosures 로 받아온다(브라우저는 데이터 소스를 직접 읽지 않는다). 관심종목은
 * localStorage 에 {code, name} 로 저장한다 — 유니버스 밖 종목도 이름을 표시하기 위함
 * (ADR-0002, 스펙 US-19). 읽음 상태도 localStorage.
 */
import { useEffect } from "react";
import { STOCK_MASTER, DEFAULT_WATCHLIST } from "@/lib/mock/stocks";
import type {
  Disclosure,
  Period,
  StructuredField,
  StockSearchItem,
} from "@/lib/types";

/** 관심종목 저장 항목 — 이름을 함께 담아 임의 종목도 칩/그룹에 표시 */
interface WatchItem {
  code: string;
  name: string;
}

export default function Page() {
  useEffect(() => {
    const HOUR = 3600 * 1000;
    const NOW = new Date();

    /** 주요 종목 유니버스 이름(마이그레이션·시드용) */
    const UNIV_NAME: Record<string, string> = {};
    STOCK_MASTER.forEach((s) => {
      UNIV_NAME[s.code] = s.name;
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
    async function searchStocksApi(q: string): Promise<StockSearchItem[]> {
      const res = await fetch(`/api/stocks?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error(`검색 실패 (${res.status})`);
      const data = (await res.json()) as { items: StockSearchItem[] };
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

    /** 저장분을 {code, name}[] 로 정규화 (구버전 string[] 및 이름 누락 보정) */
    function migrateWatch(raw: unknown): WatchItem[] {
      if (!Array.isArray(raw)) return [];
      return raw
        .map((e): WatchItem => {
          if (typeof e === "string") return { code: e, name: UNIV_NAME[e] ?? e };
          const code = String((e as WatchItem)?.code ?? "");
          const name = String((e as WatchItem)?.name ?? UNIV_NAME[code] ?? code);
          return { code, name };
        })
        .filter((w) => /^\d{6}$/.test(w.code));
    }

    const storedWatch = lsGet<unknown>(LS_WATCH, null);
    let watchlist: WatchItem[];
    if (storedWatch == null || !Array.isArray(storedWatch)) {
      watchlist = DEFAULT_WATCHLIST.map((c) => ({
        code: c,
        name: UNIV_NAME[c] ?? c,
      }));
      lsSet(LS_WATCH, watchlist);
    } else {
      watchlist = migrateWatch(storedWatch);
    }

    const readIds = new Set<string>(lsGet<string[]>(LS_READ, []));
    let period: Period = "week";
    let view: "feed" | "byStock" = "byStock";
    let searchActiveIdx = -1;
    let firstRender = true;
    let reqSeq = 0;
    let lastItems: Disclosure[] = [];
    let modalOpen = false;
    let lastTrigger: HTMLElement | null = null;
    /** 종목 카드 펼침 상태 — 메모리만(재방문 시 기본은 전부 접힘) */
    const expandedStocks = new Set<string>();

    // 검색(비동기) 상태
    let searchItems: StockSearchItem[] = [];
    let searchSeq = 0;
    let searchTimer: ReturnType<typeof setTimeout> | null = null;
    let searchLoading = false;

    function saveWatch() {
      lsSet(LS_WATCH, watchlist);
    }
    function saveRead() {
      lsSet(LS_READ, Array.from(readIds));
    }
    function watchCodes(): string[] {
      return watchlist.map((w) => w.code);
    }
    function isWatched(code: string): boolean {
      return watchlist.some((w) => w.code === code);
    }

    /* ---------- 아이콘 (SVG — 유니코드 글리프로 아이콘 대체 금지) ---------- */
    const ICON_CLOSE =
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    const ICON_EXTERNAL =
      '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" focusable="false"><path d="M13 5h6v6M19 5l-8 8M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const CHEVRON_SVG =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const SKELETON =
      '<div class="skeleton" aria-hidden="true">' +
      '<div class="sk-card"><div class="sk-line w40"></div><div class="sk-line w70"></div><div class="sk-line w55"></div></div>'.repeat(
        3
      ) +
      "</div>";

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
    const $modalOverlay = document.getElementById("modalOverlay") as HTMLDivElement;
    const $modal = $modalOverlay.querySelector(".modal") as HTMLDivElement;
    const $modalTitle = document.getElementById("modalTitle") as HTMLHeadingElement;
    const $modalClose = document.getElementById("modalClose") as HTMLButtonElement;
    const $modalBody = document.getElementById("modalBody") as HTMLDivElement;
    const $mastheadEl = document.querySelector("header.masthead") as HTMLElement | null;
    const $mainEl = document.querySelector("main.wrap") as HTMLElement | null;
    const $footerEl = document.querySelector("footer.site-footer") as HTMLElement | null;

    /* ---------- 렌더 ---------- */
    function renderHeaderMeta() {
      $headerMeta.innerHTML = "관심 <b>" + watchlist.length + "</b>종목";
    }

    function renderChips() {
      if (watchlist.length === 0) {
        $chips.innerHTML =
          '<span style="font-size:var(--t3);color:var(--fg-subtle)">등록된 종목이 없습니다.</span>';
        return;
      }
      $chips.innerHTML = watchlist
        .map((w) => {
          return (
            '<span class="chip"><span>' +
            esc(w.name) +
            '</span><span class="cd tnum">' +
            esc(w.code) +
            '</span><button data-remove="' +
            esc(w.code) +
            '" aria-label="' +
            esc(w.name) +
            ' 삭제" title="삭제">' +
            ICON_CLOSE +
            "</button></span>"
          );
        })
        .join("");
    }

    /** 화면에 표시할 검색 결과 (이미 담은 종목 제외) */
    function currentResults(): StockSearchItem[] {
      return searchItems.filter((s) => !isWatched(s.code));
    }
    function renderResults() {
      if ($search.value.trim() === "") {
        $results.classList.add("hidden");
        return;
      }
      const list = currentResults();
      if (list.length === 0) {
        $results.innerHTML = searchLoading
          ? '<div class="dd-empty">검색 중…</div>'
          : '<div class="dd-empty">일치하는 종목이 없습니다.</div>';
        $results.classList.remove("hidden");
        return;
      }
      if (searchActiveIdx >= list.length) searchActiveIdx = list.length - 1;
      $results.innerHTML = list
        .map((s, i) => {
          const meta = s.market
            ? esc(s.code) + " · " + esc(s.market)
            : esc(s.code);
          return (
            '<div class="dd-item' +
            (i === searchActiveIdx ? " active" : "") +
            '" data-add="' +
            esc(s.code) +
            '"><span class="nm">' +
            esc(s.name) +
            '</span><span class="cd tnum">' +
            meta +
            "</span>" +
            (s.inCoreUniverse ? '<span class="uni">유니버스</span>' : "") +
            "</div>"
          );
        })
        .join("");
      $results.classList.remove("hidden");
    }

    /** 입력값으로 서버 검색을 실행(디바운스는 호출부에서). 최신 요청만 반영. */
    async function runSearch(q: string) {
      const mySeq = ++searchSeq;
      searchLoading = true;
      renderResults();
      try {
        const items = await searchStocksApi(q);
        if (mySeq !== searchSeq) return;
        searchItems = items;
      } catch (e) {
        if (mySeq !== searchSeq) return;
        console.error(e);
        searchItems = [];
      } finally {
        if (mySeq === searchSeq) {
          searchLoading = false;
          renderResults();
        }
      }
    }
    function scheduleSearch() {
      const q = $search.value.trim();
      searchActiveIdx = -1;
      if (searchTimer) clearTimeout(searchTimer);
      if (!q) {
        searchItems = [];
        searchLoading = false;
        $results.classList.add("hidden");
        return;
      }
      searchTimer = setTimeout(() => void runSearch(q), 160);
    }

    function addStock(code: string) {
      const item = searchItems.find((s) => s.code === code);
      const name = item?.name ?? UNIV_NAME[code] ?? code;
      if (!/^\d{6}$/.test(code) || isWatched(code)) {
        $search.value = "";
        $results.classList.add("hidden");
        return;
      }
      watchlist.push({ code, name });
      saveWatch();
      $search.value = "";
      searchItems = [];
      searchActiveIdx = -1;
      $results.classList.add("hidden");
      renderChips();
      renderHeaderMeta();
      void renderContent();
    }
    function removeStock(code: string) {
      watchlist = watchlist.filter((w) => w.code !== code);
      saveWatch();
      renderChips();
      renderHeaderMeta();
      void renderContent();
    }

    /** 공시 상세(모달 본문) — 메타 헤더 + 주요 항목(있으면) + 요약 + 면책/원문 링크 */
    function detailHtml(d: Disclosure): string {
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
      return (
        '<div class="modal-meta"><span class="e-name">' +
        esc(d.stockName) +
        '</span><span class="e-code tnum">' +
        esc(d.stockCode) +
        '</span><span class="e-type">' +
        esc(d.type) +
        '</span><span class="ft">' +
        esc(relTime(ms)) +
        "</span></div>" +
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
        '" target="_blank" rel="noopener">원문 보기' +
        ICON_EXTERNAL +
        "</a></div>"
      );
    }

    /** 공시 목록의 클릭 트리거 행 — 상세는 모달(detailHtml)에서 표시 */
    function entryHtml(d: Disclosure, idx: number): string {
      const isNew = !readIds.has(d.id);
      const kf = keyField(d);
      const ms = submittedOf(d);
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
        (isNew ? " unread" : "") +
        (firstRender ? " reveal" : "") +
        '" data-card="' +
        esc(d.id) +
        '"' +
        revealStyle +
        '><div class="entry-row" data-open="' +
        esc(d.id) +
        '" role="button" tabindex="0" aria-haspopup="dialog"><div class="e-main"><div class="e-line1"><span class="ind"></span><span class="e-name">' +
        esc(d.stockName) +
        '</span><span class="e-code tnum">' +
        esc(d.stockCode) +
        '</span><span class="e-type">' +
        esc(d.type) +
        '</span></div><h3 class="e-title">' +
        esc(d.title) +
        "</h3></div>" +
        figure +
        "</div></article>"
      );
    }

    /** 종목별 보기의 접힌 카드(레벨0) — 클릭 시 인라인 펼침(레벨1), 공시 클릭 시 모달(레벨2) */
    function stockCardHtml(
      code: string,
      name: string,
      g: Disclosure[],
      giStart: number
    ): string {
      const open = expandedStocks.has(code);
      const unread = g.filter((d) => !readIds.has(d.id)).length;
      let gi = giStart;
      return (
        '<section class="stock-card' +
        (open ? " open" : "") +
        '"><header class="stock-card-head" role="button" tabindex="0" aria-expanded="' +
        open +
        '" aria-controls="panel-' +
        esc(code) +
        '" data-stock="' +
        esc(code) +
        '"><span class="chev" aria-hidden="true">' +
        CHEVRON_SVG +
        '</span><span class="nm">' +
        esc(name) +
        "</span>" +
        (code === "__unmatched"
          ? ""
          : '<span class="cd tnum">' + esc(code) + "</span>") +
        '<span class="cnt">' +
        g.length +
        "건</span>" +
        (unread > 0
          ? '<span class="new-badge">신규 ' + unread + "</span>"
          : "") +
        '</header><div class="stock-panel" id="panel-' +
        esc(code) +
        '" role="region" aria-label="' +
        esc(name) +
        ' 공시"><div class="stock-panel-inner">' +
        g.map((d) => entryHtml(d, gi++)).join("") +
        "</div></div></section>"
      );
    }

    function renderList(items: Disclosure[]) {
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
        const watchCodeSet = new Set(watchlist.map((w) => w.code));
        let html = "";
        let gi = 0;
        watchlist.forEach((w) => {
          const g = byCode[w.code];
          if (!g || !g.length) return;
          html += stockCardHtml(w.code, w.name, g, gi);
          gi += g.length;
        });
        // 관심종목 코드와 일치하지 않는 공시(응답의 stockCode 포맷 불일치 등)를 조용히
        // 누락시키지 않도록 방어적으로 별도 버킷에 모은다.
        const unmatched = items.filter((d) => !watchCodeSet.has(d.stockCode));
        if (unmatched.length) {
          html += stockCardHtml("__unmatched", "미분류", unmatched, gi);
          gi += unmatched.length;
        }
        $content.innerHTML = html;
      }
    }

    async function renderContent() {
      const codes = watchCodes();
      if (codes.length === 0) {
        $content.innerHTML =
          '<div class="empty"><div class="t">아직 등록한 관심종목이 없어요</div><div class="d">위에서 종목을 추가하면 새 공시 요약이 여기 쌓입니다.</div></div>';
        $unread.innerHTML = "";
        firstRender = false;
        return;
      }

      const mySeq = ++reqSeq;
      $content.innerHTML = SKELETON;
      $unread.innerHTML = "";

      try {
        const items = await getDisclosures(codes, period);
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

    /** 종목 카드 펼침/접힘 토글 — 전체 재렌더 없이 DOM 클래스만 바꿔 포커스·비용을 아낀다. */
    function toggleStock(code: string, headEl: HTMLElement) {
      const open = !expandedStocks.has(code);
      if (open) expandedStocks.add(code);
      else expandedStocks.delete(code);
      const section = headEl.closest(".stock-card");
      section?.classList.toggle("open", open);
      headEl.setAttribute("aria-expanded", String(open));
    }

    /** 배경(main/header/footer)을 모달 열림 동안 보조기술에서 숨긴다. */
    function setInert(on: boolean) {
      [$mastheadEl, $mainEl, $footerEl].forEach((el) => {
        if (!el) return;
        if (on) el.setAttribute("inert", "");
        else el.removeAttribute("inert");
      });
    }

    function openModal(d: Disclosure, trigger: HTMLElement) {
      lastTrigger = trigger;
      $modalTitle.textContent = d.title;
      $modalBody.innerHTML = detailHtml(d);
      $modalOverlay.classList.remove("hidden");
      document.body.style.overflow = "hidden";
      setInert(true);
      modalOpen = true;
      $modalClose.focus();
      if (!readIds.has(d.id)) {
        readIds.add(d.id);
        saveRead();
        // 재조회 없이 캐시된 목록으로 다시 그린다(읽음 표시 반영).
        firstRender = false;
        renderList(lastItems);
      }
    }
    function closeModal() {
      $modalOverlay.classList.add("hidden");
      document.body.style.overflow = "";
      setInert(false);
      modalOpen = false;
      lastTrigger?.focus();
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
      scheduleSearch();
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
      const head = (e.target as HTMLElement).closest("[data-stock]");
      if (head) {
        toggleStock(head.getAttribute("data-stock") as string, head as HTMLElement);
        return;
      }
      const h = (e.target as HTMLElement).closest("[data-open]");
      if (!h) return;
      const id = h.getAttribute("data-open") as string;
      const d = lastItems.find((x) => x.id === id);
      if (d) openModal(d, h as HTMLElement);
    };
    const onContentKeydown = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const head = (e.target as HTMLElement).closest("[data-stock]");
      if (head) {
        e.preventDefault();
        toggleStock(head.getAttribute("data-stock") as string, head as HTMLElement);
        return;
      }
      const h = (e.target as HTMLElement).closest("[data-open]");
      if (h) {
        e.preventDefault();
        const id = h.getAttribute("data-open") as string;
        const d = lastItems.find((x) => x.id === id);
        if (d) openModal(d, h as HTMLElement);
      }
    };
    const onModalCloseClick = () => closeModal();
    const onOverlayClick = (e: MouseEvent) => {
      if (e.target === $modalOverlay) closeModal();
    };
    const onDocKeydown = (e: KeyboardEvent) => {
      if (!modalOpen) return;
      if (e.key === "Escape") {
        closeModal();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = Array.from(
        $modal.querySelectorAll<HTMLElement>(
          'a[href], button, [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === first || !$modal.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !$modal.contains(active)) {
          e.preventDefault();
          first.focus();
        }
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
    $modalClose.addEventListener("click", onModalCloseClick);
    $modalOverlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onDocKeydown);

    /* ---------- 초기화 ---------- */
    setActive($periodToggle, period);
    setActive($viewToggle, view);
    renderHeaderMeta();
    renderChips();
    void renderContent();

    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onDocKeydown);
      if (searchTimer) clearTimeout(searchTimer);
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <>
      <a className="skip-link" href="#content">
        본문 바로가기
      </a>

      <header className="masthead">
        <div className="masthead-inner">
          <span className="brand">
            관심종목 <span className="accent">공시</span>
          </span>
        </div>
      </header>

      <main className="wrap">
        <div className="page-head">
          <h1>새 공시, 요약해서 한눈에</h1>
          <div className="meta" id="headerMeta" />
        </div>

        <div className="search-wrap">
          <input
            id="searchInput"
            type="text"
            autoComplete="off"
            aria-label="관심종목 검색"
            placeholder="관심종목 추가 — 종목명 또는 코드 검색"
          />
          <div id="searchResults" className="dropdown hidden" />
        </div>
        <div id="watchChips" className="chips" />

        <div className="filters">
          <div className="tabs" id="periodToggle" role="group" aria-label="조회 기간">
            <button type="button" data-value="today">오늘</button>
            <button type="button" data-value="week">1주</button>
            <button type="button" data-value="month">1개월</button>
          </div>
          <div className="tabs" id="viewToggle" role="group" aria-label="보기 방식">
            <button type="button" data-value="feed">최신순</button>
            <button type="button" data-value="byStock">종목별</button>
          </div>
          <div className="status" id="unreadCount" />
        </div>

        <section id="content" tabIndex={-1} aria-label="공시 목록" />
      </main>

      <div id="modalOverlay" className="modal-overlay hidden">
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div className="modal-head">
            <h2 id="modalTitle" />
            <button type="button" id="modalClose" className="modal-close" aria-label="닫기">
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M6 6l12 12M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div id="modalBody" className="modal-body" />
        </div>
      </div>

      <footer className="site-footer">
        <div className="footer-inner">
          <p>
            공시 요약은 DART 원문을 바탕으로 자동 생성된 정보 제공용이며, 특정 종목의
            매수·매도나 투자를 권유하는 것이 아닙니다. 투자 판단과 그 결과에 대한
            책임은 투자자 본인에게 있습니다. 원문은 각 항목의 ‘원문 보기’에서 확인하세요.
          </p>
          <p className="attr">
            데이터 출처: 금융감독원 전자공시시스템(DART). 화면은 전자정부 디자인 시스템(KRDS)의
            시각 언어를 참고했습니다.
          </p>
        </div>
      </footer>
    </>
  );
}
