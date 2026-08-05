import { selectIsCustomerAuthenticated } from '../../../features/userAuth/userAuthSlice';
import { useBookingFlow } from '../../../hooks/useBookingFlow';
import { useGoogleAuth } from '../../../hooks/useGoogleAuth';
import { useAppSelector } from '../../../store/hooks';
import { GoogleSignInButton } from '../../auth/GoogleSignInButton';
import { SectionHeading } from '../../landing/SectionHeading';
import { BookingForm } from '../BookingForm';
import { DateServiceSelector } from '../DateServiceSelector';
import { PaymentChoice } from '../PaymentChoice';
import { SlotGrid } from '../SlotGrid';

export const BookingSection = (): JSX.Element => {
  const {
    date,
    setDate,
    service,
    setService,
    selectedTime,
    setSelectedTime,
    slots,
    isLoadingSlots,
    servicios,
    submitBooking,
    subscribeAndBook,
    hasCredits,
    hasActivePlan,
    isSubmitting,
  } = useBookingFlow();

  const isAuthenticated = useAppSelector(selectIsCustomerAuthenticated);
  const { handleCredential, error: googleAuthError } = useGoogleAuth();

  if (!isAuthenticated) {
    return (
      <section id="reservar" className="mx-auto max-w-site border-b border-border px-8 py-24 text-center max-md:px-5 max-md:py-16">
        <SectionHeading tag="05 — Reservá tu hora">Recovery Room · Turnos</SectionHeading>
        <p className="mx-auto mb-8 max-w-[480px] text-lg text-neutral-300">Iniciá sesión con Google para reservar tu turno.</p>
        <div className="flex justify-center">
          <GoogleSignInButton onCredential={handleCredential} />
        </div>
        {googleAuthError && <p className="mt-3.5 text-sm text-destructive">{googleAuthError}</p>}
      </section>
    );
  }

  return (
    <section id="reservar" className="mx-auto max-w-site border-b border-border px-8 py-24 max-md:px-5 max-md:py-16">
      <SectionHeading tag="05 — Reservá tu hora">Recovery Room · Turnos</SectionHeading>
      <p className="max-w-[720px] text-lg text-neutral-300">Bloques de 1 hora. Mañanas de 7:00 a 11:00 y tardes de 15:00 a 20:00.</p>

      <div className="mt-11 grid gap-6 max-md:grid-cols-1 md:grid-cols-[1.1fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-7">
          <DateServiceSelector date={date} onDateChange={setDate} service={service} onServiceChange={setService} servicios={servicios} />
          <p className="mb-3 mt-5 text-xs uppercase tracking-wide text-muted-foreground">Elegí un horario</p>
          <SlotGrid slots={slots} selectedTime={selectedTime} onSelect={setSelectedTime} isLoading={isLoadingSlots} />
        </div>

        {hasCredits ? (
          <BookingForm date={date} selectedTime={selectedTime} isSubmitting={isSubmitting} onSubmit={submitBooking} />
        ) : (
          <PaymentChoice
            resetSessionPrice={600}
            hasActivePlan={hasActivePlan}
            onPayOneOff={() => submitBooking({ notes: '' })}
            onSubscribe={subscribeAndBook}
          />
        )}
      </div>
    </section>
  );
};
