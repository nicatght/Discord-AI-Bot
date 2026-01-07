/**
 * RAG 搜尋工具
 *
 * TODO: 實作 RAG 搜尋工具（Function Calling）
 */

export interface SearchToolResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

export class SearchTool {
  // TODO: 實作搜尋工具
  // - search(query: string): Promise<SearchToolResult>
}

