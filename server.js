// server.js - OpenAI to NVIDIA NIM API Proxy (Universal Version)
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// NVIDIA NIM API configuration
const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

// Feature toggles
const SHOW_REASONING = false;
const ENABLE_THINKING_MODE = false;

// Model mapping
const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'gpt-4': 'qwen/qwen3-coder-480b-a35b-instruct',
  'gpt-4-turbo': 'moonshotai/kimi-k2-instruct-0905',
  'gpt-4o': 'deepseek-ai/deepseek-v3.1',
  'claude-3-opus': 'openai/gpt-oss-120b',
  'claude-3-sonnet': 'openai/gpt-oss-20b',
  'gemini-pro': 'qwen/qwen3-next-80b-a3b-thinking'
};

// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'NVIDIA NIM OpenAI Proxy is live on Render 🚀',
    endpoints: [
      '/health',
      '/v1/models',
      '/v1/chat/completions',
      '/chat/completions',
      '/v1/completions',
      '/completions'
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OpenAI to NVIDIA NIM Proxy',
    reasoning_display: SHOW_REASONING,
    thinking_mode: ENABLE_THINKING_MODE
  });
});

// Models endpoint
app.get(['/v1/models', '/models'], (req, res) => {
  const models = Object.keys(MODEL_MAPPING).map(model => ({
    id: model,
    object: 'model',
    created: Date.now(),
    owned_by: 'nvidia-nim-proxy'
  }));

  res.json({ object: 'list', data: models });
});

// Main completion handler
const handleCompletions = async (req, res) => {
  try {
    const { model, messages, prompt, temperature, max_tokens, stream } = req.body;
    const nimModel = MODEL_MAPPING[model] || 'meta/llama-3.1-8b-instruct';

    const nimRequest = messages
      ? { model: nimModel, messages, temperature, max_tokens, stream }
      : { model: nimModel, messages: [{ role: 'user', content: prompt }], temperature, max_tokens, stream };

    const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, {
      headers: {
        Authorization: `Bearer ${NIM_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.data.on('data', chunk => res.write(chunk));
      response.data.on('end', () => res.end());
      response.data.on('error', err => {
        console.error('Stream error:', err);
        res.end();
      });
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(error.response?.status || 500).json({
      error: {
        message: error.message,
        type: 'invalid_request_error',
        code: error.response?.status || 500
      }
    });
  }
};

// ✅ Register all common routes
app.post(['/v1/chat/completions', '/chat/completions'], handleCompletions);
app.post(['/v1/completions', '/completions'], handleCompletions);

// Catch-all
app.all('*', (req, res) => {
  res.status(404).json({
    error: {
      message: `Endpoint ${req.path} not found`,
      type: 'invalid_request_error',
      code: 404
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ OpenAI → NVIDIA NIM Proxy running on Render at port ${PORT}`);
});
