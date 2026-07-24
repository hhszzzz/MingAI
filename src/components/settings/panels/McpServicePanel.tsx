'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Cloud, Copy, Terminal } from 'lucide-react';
import {
  MCP_PUBLIC_TOOLS,
  MCP_PUBLIC_URL,
  buildMcpPublicHttpConfig,
  buildMcpStdioNpxConfig,
} from '@/lib/mcp-service-config';

type McpConnectionMode = 'remote' | 'stdio';

function CodeBlock({
  title,
  snippet,
  snippetId,
  copiedSnippet,
  onCopy,
}: {
  title: string;
  snippet: string;
  snippetId: string;
  copiedSnippet: string | null;
  onCopy: (snippetId: string, content: string) => Promise<void>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <button
          type="button"
          onClick={() => onCopy(snippetId, snippet)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-foreground-secondary transition-colors hover:bg-background-secondary hover:text-foreground"
          aria-label={`复制${title}`}
          title={`复制${title}`}
        >
          {copiedSnippet === snippetId ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto rounded-md bg-background-secondary p-3 text-xs leading-6 text-foreground">{snippet}</pre>
    </div>
  );
}

export default function McpServicePanel() {
  const [mode, setMode] = useState<McpConnectionMode>('remote');
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const copy = async (snippetId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setError(null);
      setCopiedSnippet(snippetId);
      window.setTimeout(() => setCopiedSnippet((current) => current === snippetId ? null : current), 2000);
    } catch {
      setError('复制失败，请手动选择配置内容。');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-fade-in">
      {error ? (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 p-3 text-sm text-red-500">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="flex rounded-md border border-border bg-background-secondary p-1" role="tablist" aria-label="MCP 接入方式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'remote'}
          onClick={() => setMode('remote')}
          className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${mode === 'remote' ? 'bg-background text-foreground shadow-sm' : 'text-foreground-secondary hover:text-foreground'}`}
        >
          <Cloud className="h-4 w-4" />
          远程服务
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'stdio'}
          onClick={() => setMode('stdio')}
          className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${mode === 'stdio' ? 'bg-background text-foreground shadow-sm' : 'text-foreground-secondary hover:text-foreground'}`}
        >
          <Terminal className="h-4 w-4" />
          本地 Stdio
        </button>
      </div>

      {mode === 'remote' ? (
        <section className="space-y-5" aria-labelledby="mcp-remote-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 id="mcp-remote-heading" className="font-semibold text-foreground">公开 Streamable HTTP</h2>
              <code className="mt-1 block break-all text-xs text-foreground-secondary">{MCP_PUBLIC_URL}</code>
            </div>
            <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">无需认证</span>
          </div>
          <CodeBlock
            title="客户端配置"
            snippet={buildMcpPublicHttpConfig()}
            snippetId="remote-config"
            copiedSnippet={copiedSnippet}
            onCopy={copy}
          />
        </section>
      ) : (
        <section className="space-y-5" aria-labelledby="mcp-stdio-heading">
          <div className="border-b border-border pb-4">
            <h2 id="mcp-stdio-heading" className="font-semibold text-foreground">本地进程</h2>
            <p className="mt-1 text-sm text-foreground-secondary">需要 Node.js 和支持 Stdio 的 MCP 客户端。</p>
          </div>
          <CodeBlock
            title="客户端配置"
            snippet={buildMcpStdioNpxConfig()}
            snippetId="stdio-config"
            copiedSnippet={copiedSnippet}
            onCopy={copy}
          />
        </section>
      )}

      <section className="space-y-3 border-t border-border pt-5" aria-labelledby="mcp-tools-heading">
        <div className="flex items-center gap-2">
          <h2 id="mcp-tools-heading" className="font-semibold text-foreground">可用工具</h2>
          <span className="text-xs text-foreground-secondary">{MCP_PUBLIC_TOOLS.length}</span>
        </div>
        <div className="grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2">
          {MCP_PUBLIC_TOOLS.map((tool) => (
            <div key={tool.id} className="min-w-0 bg-background px-3 py-2.5">
              <code className="block truncate text-xs text-foreground">{tool.id}</code>
              <span className="mt-0.5 block text-xs text-foreground-secondary">{tool.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
