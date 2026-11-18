import {
  cambiarEstado,
  listarSolicitudes,
  obtenerHistorial,
  obtenerSolicitud,
  solicitarInformacion,
} from '../services/solicitudes.service.js';

export async function getSolicitudes(req, res) {
  res.json({ ok: true, ...(await listarSolicitudes(req.query)) });
}

export async function getSolicitud(req, res) {
  res.json({ ok: true, data: await obtenerSolicitud(req.params.id) });
}

export async function patchEstado(req, res) {
  const data = await cambiarEstado(req.params.id, req.body || {}, req.user);
  res.json({ ok: true, mensaje: `Solicitud actualizada: ${data.estado}`, data });
}

export async function postResponder(req, res) {
  const data = await solicitarInformacion(req.params.id, req.body || {}, req.user);
  res.json({ ok: true, mensaje: 'Solicitud de información enviada al solicitante', data });
}

export async function getHistorial(req, res) {
  res.json({ ok: true, data: await obtenerHistorial(req.params.id) });
}
