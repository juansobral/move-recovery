import { SLOTS, SERVICIOS } from '../lib/db.js';

export default function handler(req, res) {
  res.status(200).json({ slots: SLOTS, servicios: SERVICIOS });
}
