import { useEffect, useState } from 'react';
import { useGetAvailabilityQuery } from '../features/api/availabilityApi';
import { useGetConfigQuery } from '../features/api/configApi';
import { useCreateBookingMutation } from '../features/api/userApi';
import { todayStr } from '../lib/dateUtils';
import type { ClientFieldsValues } from '../schemas/booking.schema';
import type { CreateBookingResponse } from '../types/booking.types';

export function useBookingFlow() {
  const [date, setDate] = useState(todayStr());
  const [service, setService] = useState('');
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const { data: config } = useGetConfigQuery();
  const { data: availability, isFetching: isLoadingSlots } = useGetAvailabilityQuery(date, { skip: !date });
  const [createBookingMutation, { isLoading: isSubmitting }] = useCreateBookingMutation();

  // Igual que app.js original: cambiar de fecha limpia el horario elegido.
  useEffect(() => {
    setSelectedTime(null);
  }, [date]);

  useEffect(() => {
    if (config?.servicios?.length && !service) setService(config.servicios[0]);
  }, [config, service]);

  const submitBooking = async (values: ClientFieldsValues): Promise<CreateBookingResponse> => {
    if (!selectedTime) throw new Error('Elegí un horario.');
    const result = await createBookingMutation({ ...values, date, time: selectedTime, service }).unwrap();
    setSelectedTime(null);
    return result;
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
    isSubmitting,
  };
}
