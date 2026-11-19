const express = require('express');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const GEMINI_CHAT_MODEL = 'gemini-4-hydrogen';
const GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hypajvsnlalytainfjjn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cGFqdnNubGFseXRhaW5mampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjkyMzcsImV4cCI6MjEwODMwNTIzN30.iwGl4NxMeo_O5QCoeik7NlI__FBpFdPrLBaaQPmrY6Q';

app.use(express.json({ limit: '1mb' }));

function createGeminiClientForKey(apiKey) {
  if (!apiKey || !String(apiKey).trim()) return null;
  return new GoogleGenAI({
    apiKey: String(apiKey).trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

async function fetchTeacherPersonalGeminiKey(teacherId) {
  const idNum = Number(teacherId);
  if (!Number.isInteger(idNum) || idNum <= 0) return null;

  const url = `${SUPABASE_URL}/rest/v1/app_users?id=eq.${idNum}&select=id,gemini_api_key&limit=1`;
  const resp = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  if (!resp.ok) {
    throw new Error(`Gagal memverifikasi akun guru (HTTP ${resp.status}).`);
  }
  const rows = await resp.json();
  const key = rows?.[0]?.gemini_api_key;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

function buildTeacherSystemInstruction(context) {
  const safeCtx = context && typeof context === 'object' ? context : {};
  const ctxJson = JSON.stringify(safeCtx, null, 2).slice(0, 18000);
  return [
    'Anda adalah Asisten AI Analitik & Pembimbingan Akademik pada Dashboard Guru PantauBelajar.',
    'Jawab selalu dalam Bahasa Indonesia yang jelas, ramah, terstruktur, dan langsung dapat ditindaklanjuti guru.',
    'Gunakan HANYA data aktual kelas/mata pelajaran pada snapshot JSON di bawah ini saat menyebutkan angka, nama siswa, kehadiran, nilai, atau status tugas. Jangan pernah mengarang nama siswa atau angka yang tidak ada di data.',
    'Jika data kelas belum dipilih atau masih kosong, sampaikan dengan sopan bahwa data kelas pada workspace belum tersedia dan sarankan guru memilih kelas/mapel terlebih dahulu.',
    'Gunakan format ringkas dengan poin-poin terstruktur, sorot siswa prioritas jika relevan, dan akhiri dengan saran tindak lanjut praktis (maksimal 250-350 kata kecuali guru meminta rincian lengkap).',
    '',
    'SNAPSHOT DATA KELAS AKTIF (REAL-TIME):',
    ctxJson
  ].join('\n');
}

function mapGeminiError(err) {
  const rawMsg = String(err?.message || err || 'Terjadi kesalahan pada layanan Gemini.');
  const status = Number(err?.status || err?.statusCode || 0);

  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(rawMsg)) {
    return { status: 400, code: 'INVALID_TEACHER_KEY', message: 'API Key Gemini pribadi Anda tidak valid. Silakan perbarui di menu Pengaturan.' };
  }
  if (status === 403 || /PERMISSION_DENIED/i.test(rawMsg)) {
    return { status: 403, code: 'INVALID_TEACHER_KEY', message: 'Akses API Key Gemini pribadi Anda ditolak. Silakan periksa atau buat ulang kunci di menu Pengaturan.' };
  }
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(rawMsg)) {
    return { status: 429, message: 'Kuota akun Gemini pribadi Anda sedang mencapai batas sementara. Coba lagi beberapa saat lagi.' };
  }
  if (status === 503 || /UNAVAILABLE|high demand|overloaded/i.test(rawMsg)) {
    return { status: 503, message: 'Server Gemini sedang mengalami lonjakan trafik sementara. Silakan kirim ulang dalam beberapa detik.' };
  }
  if (status === 404 || /NOT_FOUND/i.test(rawMsg)) {
    return { status: 404, message: 'Model Gemini belum tersedia untuk kunci API pribadi Anda.' };
  }

  let cleanMsg = rawMsg;
  try {
    const parsed = JSON.parse(rawMsg);
    const inner = parsed?.error?.message || parsed?.message;
    if (typeof inner === 'string') {
      try {
        const innerParsed = JSON.parse(inner);
        cleanMsg = innerParsed?.error?.message || inner;
      } catch {
        cleanMsg = inner;
      }
    }
  } catch { /* keep rawMsg */ }

  return { status: status >= 400 && status < 600 ? status : 500, message: cleanMsg };
}

async function generateStreamWithRetry(ai, params, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await ai.models.generateContentStream(params);
    } catch (err) {
      lastErr = err;
      const status = Number(err?.status || err?.statusCode || 0);
      const isRetryable = status === 429 || status === 503 || status >= 500 || status === 0;
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }
  throw lastErr;
}

app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Service-Worker-Allowed', '/');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

app.use(express.static(path.join(__dirname), {
  extensions: ['html']
}));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/gemini/teacher-chat', async (req, res) => {
  const { teacherId, message, history = [], context = {} } = req.body || {};

  const idNum = Number(teacherId);
  if (!Number.isInteger(idNum) || idNum <= 0) {
    return res.status(401).json({
      code: 'AUTH_REQUIRED',
      error: 'Sesi guru tidak valid. Silakan login kembali.'
    });
  }

  let teacherApiKey = null;
  try {
    teacherApiKey = await fetchTeacherPersonalGeminiKey(idNum);
  } catch (lookupErr) {
    return res.status(502).json({ error: lookupErr.message || 'Gagal memeriksa koneksi Gemini pribadi Anda.' });
  }

  if (!teacherApiKey) {
    return res.status(400).json({
      code: 'MISSING_TEACHER_KEY',
      error: 'Akun Gemini pribadi Anda belum terhubung. Silakan hubungkan terlebih dahulu di menu Pengaturan agar kuota token tetap terpisah untuk masing-masing guru.'
    });
  }

  const ai = createGeminiClientForKey(teacherApiKey);

  const trimmedMsg = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMsg) {
    return res.status(400).json({ error: 'Pesan pertanyaan tidak boleh kosong.' });
  }

  const contents = [];
  if (Array.isArray(history)) {
    const recent = history.slice(-12);
    for (const turn of recent) {
      if (!turn || typeof turn.text !== 'string' || !turn.text.trim()) continue;
      const role = turn.role === 'model' ? 'model' : 'user';
      contents.push({ role, parts: [{ text: turn.text.trim().slice(0, 4000) }] });
    }
  }
  contents.push({ role: 'user', parts: [{ text: trimmedMsg.slice(0, 4000) }] });

  const systemInstruction = buildTeacherSystemInstruction(context);

  try {
    let stream;
    try {
      stream = await generateStreamWithRetry(ai, {
        model: GEMINI_CHAT_MODEL,
        contents,
        config: { systemInstruction }
      });
    } catch (primaryErr) {
      const status = Number(primaryErr?.status || primaryErr?.statusCode || 0);
      const raw = String(primaryErr?.message || '');
      if (status === 404 || /NOT_FOUND|not found/i.test(raw)) {
        stream = await generateStreamWithRetry(ai, {
          model: GEMINI_FALLBACK_MODEL,
          contents,
          config: { systemInstruction }
        });
      } else {
        throw primaryErr;
      }
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    for await (const chunk of stream) {
      const piece = chunk.text;
      if (piece) {
        res.write(`data: ${JSON.stringify({ text: piece })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    const mapped = mapGeminiError(err);
    if (!res.headersSent) {
      return res.status(mapped.status).json({ error: mapped.message, code: mapped.code });
    }
    res.write(`data: ${JSON.stringify({ error: mapped.message, code: mapped.code })}\n\n`);
    res.end();
  }
});

app.listen(PORT, HOST, () => {
  console.log(`PantauBelajar server listening at http://${HOST}:${PORT}`);
});
