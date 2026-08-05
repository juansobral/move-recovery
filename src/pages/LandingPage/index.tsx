import { BookingSection } from '../../components/booking/BookingSection';
import { AboutSection } from '../../components/landing/AboutSection';
import { Hero } from '../../components/landing/Hero';
import { LocationSection } from '../../components/landing/LocationSection';
import { RecoveryRoomSection } from '../../components/landing/RecoveryRoomSection';
import { ServicesSection } from '../../components/landing/ServicesSection';
import { TeamSection } from '../../components/landing/TeamSection';
import { SiteFooter } from '../../components/layout/SiteFooter';
import { SiteNav } from '../../components/layout/SiteNav';
import { useAnchorScroll } from '../../hooks/useAnchorScroll';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export const LandingPage = (): JSX.Element => {
  useDocumentTitle('MOVE® Strength & Conditioning · Performance & Rehab');
  useAnchorScroll();

  return (
    <>
      <SiteNav />
      <Hero />
      <AboutSection />
      <TeamSection />
      <ServicesSection />
      <RecoveryRoomSection />
      <BookingSection />
      <LocationSection />
      <SiteFooter />
    </>
  );
};
