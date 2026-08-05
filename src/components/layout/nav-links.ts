export interface NavLink {
  href: string;
  label: string;
}

export const NAV_LINKS: NavLink[] = [
  { href: '#nosotros', label: 'Nosotros' },
  { href: '#equipo', label: 'Equipo' },
  { href: '#servicios', label: 'Servicios' },
  { href: '#recovery', label: 'Recovery Room' },
  { href: '#ubicacion', label: 'Ubicación' },
  { href: '#reservar', label: 'Reservar' },
];
