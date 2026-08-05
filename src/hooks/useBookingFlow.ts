import { useEffect, useState } from 'react';
import { useGetAvailabilityQuery } from '../features/api/availabilityApi';
import { useGetConfigQuery } from '../features/api/configApi';
import {
  useCreateBookingCheckoutMutation,
  useCreateSubscriptionCheckoutMutation,
  useGetMySubscriptionQuery,
} from '../features/api/userApi';
import { todayStr } from '../lib/dateUtils';
import type { ClientFieldsValues } from '../schemas/booking.schema';
import type { CreateBookingResponse } from '../types/booking.types';

export function useBookingFlow() {
  const [date, setDate] = useState(todayStr());
  const [service, setService] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: config } = useGetConfigQuery();
  const { data: availability, isFetching: isLoadingSlots } = useGetAvailabilityQuery(date, { skip: !date });
  const { data: subscription } = useGetMySubscriptionQuery();
  const [createBookingCheckout, { isLoading: isSubmitting }] = useCreateBookingCheckoutMutation();
  const [createSubscriptionCheckout] = useCreateSubscriptionCheckoutMutation();

  const hasCredits = Boolean(subscription && subscription.currentPeriodEnd >= todayStr() && subscription.sessionCreditsRemaining > 0);

  // Igual que app.js original: cambiar de fecha limpia el horario elegido.
  useEffect(() => {
    setSelectedTime(null);
  }, [date]);

  useEffect(() => {
    if (config?.servicios?.length && !service) setService(config.servicios[0]);
  }, [config, service]);

  const submitBooking = async (values: ClientFieldsValues): Promise<CreateBookingResponse> => {
    if (!selectedTime) throw new Error('Elegí un horario.');
    const result = await createBookingCheckout({ ...values, date, time: selectedTime, service }).unwrap();
    if (result.requiresPayment && result.initPoint) {
      window.location.assign(result.initPoint);
      return new Promise(() => {}); // navegando afuera, esta promesa nunca necesita resolverse
    }
    setSelectedTime(null);
    return result as CreateBookingResponse;
  };

  const subscribeAndBook = async (plan: 'standard' | 'premium'): Promise<void> => {
    if (!selectedTime) throw new Error('Elegí un horario.');
    const { initPoint } = await createSubscriptionCheckout({
      plan,
      intendedBooking: { date, time: selectedTime, service },
    }).unwrap();
    window.location.assign(initPoint);
  };

  return {
    date,
    setDate,
    service,
    setService,
    selectedTime,
    setSelectedTime,
    slots: availability?.slots ?? [],
    isLoadingSlots,
    servicios: config?.servicios ?? [],
    submitBooking,
    subscribeAndBook,
    hasCredits,
    isSubmitting,
  };
}
