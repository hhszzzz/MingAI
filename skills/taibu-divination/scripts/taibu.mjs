#!/usr/bin/env node
/**
 * taibu-divination skill CLI — 零安装本地占术计算。
 * 全部计算来自随 skill 分发的 vendor/taibu-core.bundle.mjs，唯一运行要求 Node >= 18。
 *
 * 用法:
 *   node taibu.mjs list                     # 列出全部工具
 *   node taibu.mjs schema <tool>            # 查看某工具的参数说明与示例
 *   node taibu.mjs call <tool> '<json>'     # 调用工具（参数为 JSON 字符串）
 *   node taibu.mjs call <tool> - [--json]   # 从 stdin 读 JSON（推荐，避免转义问题）；--json 输出结构化 JSON
 */
import { readFileSync } from 'node:fs';

const USAGE = `用法:
  node taibu.mjs list                     列出全部工具（工具名 + 用途）
  node taibu.mjs schema <tool>            查看工具参数说明与调用示例
  node taibu.mjs call <tool> '<json>'     调用工具，参数为 JSON 字符串
  node taibu.mjs call <tool> -            参数从 stdin 读取（推荐，避免引号转义问题）
选项:
  --json                                  call 时输出机器可读的 structuredContent JSON（默认输出规范文本）`;

function fail(code, message) {
  console.error(message);
  process.exit(code);
}

const core = await import(new URL('./vendor/taibu-core.bundle.mjs', import.meta.url).href).catch((error) =>
  fail(2, `无法加载 vendor/taibu-core.bundle.mjs（skill 文件不完整？）: ${error.message}`),
);
const { listToolDefinitions, executeTool, renderToolResult, normalizeTransportDetailLevel } = core;

const argv = process.argv.slice(2);
const jsonOutput = argv.includes('--json');
const [command, toolName, rawArgs] = argv.filter((arg) => arg !== '--json');

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log(USAGE);
  process.exit(command ? 0 : 2);
}

if (command === 'list') {
  const width = Math.max(...listToolDefinitions().map((tool) => tool.name.length)) + 2;
  for (const tool of listToolDefinitions()) {
    const [summary] = tool.description.split('\n', 1);
    console.log(`${tool.name.padEnd(width)}${tool.title} — ${summary}`);
  }
  process.exit(0);
}

if (command === 'schema') {
  if (!toolName) fail(2, `schema 需要工具名。\n${USAGE}`);
  const tool = listToolDefinitions().find((item) => item.name === toolName);
  if (!tool) {
    fail(1, `未知工具: ${toolName}。可用的工具: ${listToolDefinitions().map((item) => item.name).join(', ')}`);
  }
  console.log(
    JSON.stringify(
      { name: tool.name, title: tool.title, description: tool.description, inputSchema: tool.inputSchema },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (command !== 'call') {
  fail(2, `未知子命令: ${command}\n${USAGE}`);
}
if (!toolName || rawArgs === undefined) {
  fail(2, `call 需要工具名与 JSON 参数（或 - 表示 stdin）。\n${USAGE}`);
}

const rawJson = rawArgs === '-' ? readFileSync(0, 'utf8') : rawArgs;
let args;
try {
  args = JSON.parse(rawJson.trim() === '' ? '{}' : rawJson);
} catch (error) {
  fail(2, `JSON 参数解析失败: ${error.message}\n收到的内容: ${rawJson.slice(0, 200)}`);
}

try {
  const result = await executeTool(toolName, args);
  const rendered = renderToolResult(toolName, result, {
    detailLevel: normalizeTransportDetailLevel(args.detailLevel),
  });
  if (jsonOutput) {
    console.log(JSON.stringify(rendered.structuredContent ?? rendered.content, null, 2));
  } else {
    console.log(rendered.content.map((item) => item.text).join('\n\n'));
  }
} catch (error) {
  fail(1, error instanceof Error ? error.message : String(error));
}
