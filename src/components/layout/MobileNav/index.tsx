import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { loggedOut, selectIsCustomerAuthenticated } from '../../../features/userAuth/userAuthSlice';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '../../ui/sheet';
import { NAV_LINKS } from '../nav-links';

export const MobileNav = (): JSX.Element => {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAppSelector(selectIsCustomerAuthenticated);
  const dispatch = useAppDispatch();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="md:hidden" aria-label="Abrir menú">
        <Menu className="h-6 w-6" />
      </SheetTrigger>
      <SheetContent>
        <nav className="mt-8 flex flex-col gap-6">
          {NAV_LINKS.map((link) => (
            <SheetClose asChild key={link.href}>
              <a
                href={link.href}
                className="font-heading text-sm uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </SheetClose>
          ))}
          {isAuthenticated && (
            <>
              <SheetClose asChild>
                <Link
                  to="/mi-cuenta"
                  className="font-heading text-sm uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                >
                  Mi cuenta
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <button
                  type="button"
                  className="text-left font-heading text-sm uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => dispatch(loggedOut())}
                >
                  Salir
                </button>
              </SheetClose>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
};
