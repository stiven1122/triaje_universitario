import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import * as auth from '../controllers/auth.controller.js';
import * as correos from '../controllers/correos.controller.js';
import * as solicitudes from '../controllers/solicitudes.controller.js';

const router = Router();

const limitarLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'DEMASIADOS_INTENTOS', error: 'Demasiados intentos. Espera unos minutos.' },
});

// ---------- Públicas ----------
router.get('/health', (req, res) => res.json({ ok: true, servicio: 'triaje-backend', hora: new Date().toISOString() }));
router.post('/auth/login', limitarLogin, asyncHandler(auth.login));

// ---------- Protegidas (administrador / coordinador) ----------
router.use(requireAuth);

router.get('/auth/me', auth.me);

// IMPORTANTE: /estadisticas va antes de /:id
router.get('/correos/estadisticas', asyncHandler(correos.getEstadisticas));
router.get('/correos', asyncHandler(correos.getCorreos));
router.get('/correos/:id', asyncHandler(correos.getCorreo));

router.get('/solicitudes', asyncHandler(solicitudes.getSolicitudes));
router.get('/solicitudes/:id', asyncHandler(solicitudes.getSolicitud));
router.patch('/solicitudes/:id/estado', asyncHandler(solicitudes.patchEstado));
router.post('/solicitudes/:id/responder', asyncHandler(solicitudes.postResponder));
router.get('/solicitudes/:id/historial', asyncHandler(solicitudes.getHistorial));

export default router;
