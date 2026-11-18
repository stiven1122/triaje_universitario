import { listarCorreos, obtenerCorreo, obtenerEstadisticas } from '../services/correos.service.js';

export async function getCorreos(req, res) {
  res.json({ ok: true, ...(await listarCorreos(req.query)) });
}

export async function getCorreo(req, res) {
  res.json({ ok: true, data: await obtenerCorreo(req.params.id) });
}

export async function getEstadisticas(req, res) {
  res.json({ ok: true, data: await obtenerEstadisticas() });
}
