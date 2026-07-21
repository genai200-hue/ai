/** OpenDART API 베이스 URL */
export const DART_API_BASE = "https://opendart.fss.or.kr/api";

/** 공시 원문 뷰어 베이스 */
export const DART_VIEWER_BASE = "https://dart.fss.or.kr/dsaf001/main.do";

/** 응답 최대 문자 수 (초과 시 잘라냄) */
export const CHARACTER_LIMIT = 25000;

/** 회사 이름 검색 시 반환할 최대 후보 수 */
export const MAX_COMPANY_MATCHES = 10;

/** 공시 목록 조회 시 가져올 최대 페이지 수 (페이지당 100건). 지분신고 노이즈가
 *  최신 구간을 채우므로 여러 페이지를 받아 주요 공시까지 도달한다. */
export const MAX_LIST_PAGES = 5;
export const LIST_PAGE_SIZE = 100;
