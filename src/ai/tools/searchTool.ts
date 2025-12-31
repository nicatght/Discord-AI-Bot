// TODO: 实现 RAG 搜索工具（Function Calling）

export interface SearchToolResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
}

export class SearchTool {
  // TODO: 实现搜索工具
  // - search(query: string): Promise<SearchToolResult>
}

