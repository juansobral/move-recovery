import { Link } from 'react-router-dom';
import { loggedOut, selectIsCustomerAuthenticated } from '../../../features/userAuth/userAuthSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { Button } from '../../ui/button';
import { MobileNav } from '../MobileNav';
import { NAV_LINKS } from '../nav-links';

export const SiteNav = (): JSX.Element => {
  const isAuthenticated = useAppSelector(selectIsCustomerAuthenticated);
  const dispatch = useAppDispatch();

  return (
    <header
      id="top"
      className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-black/[0.82] px-8 py-[18px] backdrop-blur-[10px] max-md:px-5 max-md:py-3.5"
    >
      <Link to="/" className="font-heading text-2xl font-black tracking-[2px]">
        MOVE<span className="align-super text-xs font-semibold">®</span>
      </Link>
      <nav className="hidden gap-7 md:flex">
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-[13px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        {isAuthenticated ? (
          <>
            <Link
              to="/mi-cuenta"
              className="hidden text-[13px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Mi cuenta
            </Link>
            <Button type="button" variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={() => dispatch(loggedOut())}>
              Salir
            </Button>
          </>
        ) : (
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <a href="#reservar">Reservar</a>
          </Button>
        )}
        <MobileNav />
      </div>
    </header>
  );
};
