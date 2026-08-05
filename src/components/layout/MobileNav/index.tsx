import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Sheet, SheetClose, SheetContent, SheetTrigger } from '../../ui/sheet';
import { NAV_LINKS } from '../nav-links';

export const MobileNav = (): JSX.Element => {
  const [open, setOpen] = useState(false);

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
        </nav>
      </SheetContent>
    </Sheet>
  );
};
