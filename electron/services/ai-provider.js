/**
 * 通用 AI Provider — 支持 OpenAI / DeepSeek / Claude / 通义千问
 * 统一接口，根据 provider 自动适配 baseURL 和请求格式
 */

const https = require('https')
const http = require('http')
const { URL } = require('url')
const { HttpsProxyAgent } = require('hpagent')

// 代理配置
const PROXY_URL = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:10809'
let proxyAgent = null
try {
  proxyAgent = new HttpsProxyAgent({ proxy: PROXY_URL, keepAlive: true })
} catch (e) {
  console.warn('[ai-provider] Proxy agent init failed:', e.message)
}

const PROVIDERS = {
  'openai': {
    baseURL: 'https://api.openai.com/v1',
    type: 'openai',
    chatPath: '/chat/completions'
  },
  'deepseek': {
    baseURL: 'https://api.deepseek.com',
    type: 'openai',
    chatPath: '/v1/chat/completions'
  },
  'claude': {
    baseURL: 'https://api.anthropic.com/v1',
    type: 'anthropic',
    chatPath: '/messages'
  },
  'qwen': {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    type: 'openai',
    chatPath: '/chat/completions'
  },
  'local': {
    baseURL: 'http://localhost:11434/v1',
    type: 'openai',
    chatPath: '/chat/completions'
  }
}

function getProviderConfig(provider) {
  return PROVIDERS[provider] || PROVIDERS['deepseek']
}

function buildHeaders(config, apiKey) {
  if (config.type === 'anthropic') {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  }
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
}

/**
 * 将 OpenAI 格式的 messages 转为 Anthropic 格式
 */
function toAnthropicMessages(messages) {
  const result = []
  let systemContent = ''

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemContent = msg.content
      continue
    }
    result.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })
  }

  return { messages: result, system: systemContent || undefined }
}

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const lib = urlObj.protocol === 'https:' ? https : http
    const reqOpts = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers,
      timeout: options.timeout || 60000
    }
    // 国内 AI 不走代理，OpenAI/Claude 走代理
    const needsProxy = proxyAgent &&
      !urlObj.hostname.includes('deepseek.com') &&
      !urlObj.hostname.includes('aliyuncs.com')
    if (needsProxy) reqOpts.agent = proxyAgent

    const req = lib.request(reqOpts, (res) => {
      const chunks = []
      res.on('data', chunk => { chunks.push(chunk) })
      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString('utf-8')
          const json = JSON.parse(data)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json)
          } else {
            const errMsg = json.error?.message || JSON.stringify(json)
            reject(new Error(`HTTP ${res.statusCode}: ${errMsg}`))
          }
        } catch (err) {
          reject(new Error(`Parse error: ${data.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')) })
    if (body) req.write(JSON.stringify(body))
    req.end()
  })
}

function normalizeResponse(provider, raw) {
  if (provider === 'claude') {
    const textBlock = raw.content?.find(c => c.type === 'text')
    return {
      content: textBlock?.text || '',
      usage: raw.usage ? {
        promptTokens: raw.usage.input_tokens,
        completionTokens: raw.usage.output_tokens
      } : undefined
    }
  }
  // OpenAI 兼容格式 — 兼容推理模型（reasoning_content）
  const message = raw.choices?.[0]?.message || {}
  const content = message.content || message.reasoning_content || ''
  return {
    content,
    usage: raw.usage ? {
      promptTokens: raw.usage.prompt_tokens,
      completionTokens: raw.usage.completion_tokens
    } : undefined
  }
}

function normalizeStreamResponse(provider, rawChunk) {
  try {
    const data = JSON.parse(rawChunk)

    if (provider === 'claude') {
      if (data.type === 'content_block_delta' && data.delta?.type === 'text_delta') {
        return data.delta.text || ''
      }
      return ''
    }

    // OpenAI 兼容 SSE — 只用 content，忽略推理模型的 reasoning_content
    const delta = data.choices?.[0]?.delta || {}
    return delta.content || ''
  } catch {
    return ''
  }
}

class AIProvider {
  constructor({ provider, apiKey, model, baseURL: customBaseURL }) {
    this.provider = provider
    this.config = getProviderConfig(provider)
    this.apiKey = apiKey
    this.model = model
    this.baseURL = customBaseURL || this.config.baseURL
  }

  async chat({ messages, temperature = 0.3, maxTokens = 4096, stream = false, onChunk }) {
    if (stream) {
      return this._streamChat({ messages, temperature, maxTokens, onChunk })
    }
    return this._syncChat({ messages, temperature, maxTokens })
  }

  async _syncChat({ messages, temperature, maxTokens }) {
    const isAnthropic = this.config.type === 'anthropic'
    const headers = buildHeaders(this.config, this.apiKey)
    const url = `${this.baseURL}${this.config.chatPath}`

    let body
    if (isAnthropic) {
      const anthropic = toAnthropicMessages(messages)
      body = {
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: anthropic.messages
      }
      if (anthropic.system) body.system = anthropic.system
    } else {
      body = {
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens
      }
    }

    const raw = await httpRequest(url, { method: 'POST', headers, timeout: 120000 }, body)
    return normalizeResponse(this.provider, raw)
  }

  async _streamChat({ messages, temperature, maxTokens, onChunk }) {
    const isAnthropic = this.config.type === 'anthropic'
    const headers = buildHeaders(this.config, this.apiKey)
    const url = `${this.baseURL}${this.config.chatPath}`

    let body
    if (isAnthropic) {
      const anthropic = toAnthropicMessages(messages)
      body = {
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: anthropic.messages,
        stream: true
      }
      if (anthropic.system) body.system = anthropic.system
    } else {
      body = {
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true
      }
    }

    const urlObj = new URL(url)
    const lib = urlObj.protocol === 'https:' ? https : http

    const reqOpts = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { ...headers, 'Accept': 'text/event-stream' },
      timeout: 120000
    }
    const needsProxy = proxyAgent &&
      !urlObj.hostname.includes('deepseek.com') &&
      !urlObj.hostname.includes('aliyuncs.com')
    if (needsProxy) reqOpts.agent = proxyAgent

    return new Promise((resolve, reject) => {
      const req = lib.request(reqOpts, (res) => {
        let buffer = ''
        res.on('data', (chunk) => {
          buffer += chunk.toString()
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            // Anthropic SSE: "event: content_block_delta\ndata: {...}"
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') {
                resolve()
                return
              }
              const text = normalizeStreamResponse(this.provider, data)
              if (text) onChunk?.(text)
            }
          }
        })
        res.on('end', () => resolve())
      })
      req.on('error', reject)
      req.on('timeout', () => { req.destroy(); reject(new Error('Stream timeout')) })
      if (!req.destroyed) {
        req.write(JSON.stringify(body))
        req.end()
      }
    })
  }
}

function createAIProvider(config) {
  return new AIProvider(config)
}

module.exports = { createAIProvider, AIProvider, PROVIDERS }
