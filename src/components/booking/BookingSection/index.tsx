import { useBookingFlow } from '../../../hooks/useBookingFlow';
import { SectionHeading } from '../../landing/SectionHeading';
import { BookingForm } from '../BookingForm';
import { DateServiceSelector } from '../DateServiceSelector';
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
    isSubmitting,
  } = useBookingFlow();

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

        <BookingForm date={date} selectedTime={selectedTime} isSubmitting={isSubmitting} onSubmit={submitBooking} />
      </div>
    </section>
  );
};
