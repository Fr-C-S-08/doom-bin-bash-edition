import cors from 'cors';
import express from 'express';
import { narrate, type NarrateRequest } from './gameMaster.js';
import {
  isGameMasterTtsEnabled,
  isGameMasterTtsRequestEnabled,
  speakGameMasterNarration,
} from './gameMasterTts.js';

const PORT = 3001;
const GAME_CLIENT_ORIGIN = 'http://localhost:5173';

const app = express();

app.use(
  cors({
    origin: GAME_CLIENT_ORIGIN,
  }),
);
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/game-master/narrate', async (req, res) => {
  const body = (req.body ?? {}) as NarrateRequest;
  const result = await narrate(body);
  res.json(result);
  speakGameMasterNarration(result.message, result.source, {
    enabled: isGameMasterTtsRequestEnabled(body.tts),
  });
});

app.listen(PORT, () => {
  const tts = isGameMasterTtsEnabled() ? 'on' : 'off';
  console.log(`[game-master] http://localhost:${PORT} (CORS ${GAME_CLIENT_ORIGIN}, TTS ${tts})`);
});
