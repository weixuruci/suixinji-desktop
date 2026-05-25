/**
 * AI 返回内容的 JSON 解析 — 统一处理三种情况：
 *   1. 直接 JSON
 *   2. markdown 代码块 ```json ... ```
 *   3. 文本中夹带的 JSON（花括号提取）
 */

import { createEmptyEntities } from '../constants/entities'

/** 解析 AI 返回的实体提取结果，返回 entities 对象 */
export function parseExtractionResult(text) {
  return parseJSON(text, createEmptyEntities())
}

/** 通用 JSON 解析，返回解析结果或 fallback */
export function parseJSON(text, fallback = null) {
  if (!text) return fallback
  // 1. 直接 JSON
  try { return JSON.parse(text) } catch {}
  // 2. markdown 代码块
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (m) { try { return JSON.parse(m[1].trim()) } catch {} }
  // 3. 花括号提取
  const b1 = text.indexOf('{'), b2 = text.lastIndexOf('}')
  if (b1 >= 0 && b2 > b1) { try { return JSON.parse(text.slice(b1, b2 + 1)) } catch {} }
  return fallback
}
