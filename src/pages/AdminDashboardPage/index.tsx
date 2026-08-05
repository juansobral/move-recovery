import { useState } from 'react';
import { AdminTopNav } from '../../components/admin/AdminTopNav';
import { BookingsTable } from '../../components/admin/BookingsTable';
import { CancelBookingDialog } from '../../components/admin/CancelBookingDialog';
import { FilterToolbar } from '../../components/admin/FilterToolbar';
import { StatsRow } from '../../components/admin/StatsRow';
import { useGetBookingsQuery } from '../../features/api/bookingsApi';
import { useFilteredBookings } from '../../hooks/useBookingFilters';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import type { Booking } from '../../types/booking.types';

export const AdminDashboardPage = (): JSX.Element => {
  useDocumentTitle('Reservas · Admin · MOVE®');
  const { data: bookings = [], isFetching, refetch } = useGetBookingsQuery();
  const { filters, setFilters, sort, toggleSort, rows, servicios, clearFilters } = useFilteredBookings(bookings);
  const [pendingBooking, setPendingBooking] = useState<Booking | null>(null);

  return (
    <div>
      <AdminTopNav onReload={refetch} isReloading={isFetching} />
      <main className="mx-auto max-w-site space-y-6 px-8 py-8 max-md:px-5">
        <StatsRow bookings={bookings} />
        <FilterToolbar filters={filters} onFiltersChange={setFilters} servicios={servicios} onClear={clearFilters} />
        <BookingsTable rows={rows} total={bookings.length} sort={sort} onSort={toggleSort} onCancel={setPendingBooking} />
      </main>
      <CancelBookingDialog booking={pendingBooking} onOpenChange={(open) => !open && setPendingBooking(null)} />
    </div>
  );
};
