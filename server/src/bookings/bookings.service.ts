import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { SERVICIOS, SLOTS } from '../catalog/catalog.constants';
import { MailService } from '../mail/mail.service';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking } from './entities/booking.entity';
import { AvailabilityResponse, CancelBookingResponse, CreateBookingResponse } from './bookings.types';

// Códigos de Postgres para violación de restricción UNIQUE (misma
// verificación que el driver de Neon devolvía en el backend original).
const UNIQUE_VIOLATION_CODES = new Set(['23505', '23P01']);

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private readonly bookingsRepo: Repository<Booking>,
    private readonly mail: MailService,
  ) {}

  async getAvailability(dto: AvailabilityQueryDto): Promise<AvailabilityResponse> {
    const rows = await this.bookingsRepo.find({ where: { date: dto.date }, select: ['time'] });
    const taken = new Set(rows.map((r) => r.time));
    const past = dto.date < todayStr();
    return {
      date: dto.date,
      slots: SLOTS.map((time) => ({ time, available: !past && !taken.has(time) })),
    };
  }

  findAllOrdered(): Promise<Booking[]> {
    return this.bookingsRepo.find({ order: { date: 'DESC', time: 'DESC' } });
  }

  async create(dto: CreateBookingDto): Promise<CreateBookingResponse> {
    if (dto.date < todayStr()) throw new BadRequestException('No se puede reservar en una fecha pasada.');

    const service = (SERVICIOS as readonly string[]).includes(dto.service ?? '') ? (dto.service as string) : 'Recovery Room';

    let booking: Booking;
    try {
      booking = await this.bookingsRepo.save(
        this.bookingsRepo.create({
          date: dto.date,
          time: dto.time,
          name: dto.name,
          email: dto.email,
          phone: dto.phone,
          service,
          notes: dto.notes || null,
        }),
      );
    } catch (e) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException('Ese bloque ya fue reservado. Elegí otro horario.');
      }
      throw e;
    }

    // Los mails no deben poder romper una reserva ya guardada.
    const emailSent = await this.mail.enviar(this.mail.mailCliente(booking), this.mail.mailAdmin(booking)).catch(() => false);

    return { id: booking.id, date: booking.date, time: booking.time, service: booking.service, emailSent };
  }

  async cancel(id: number, notify: boolean): Promise<CancelBookingResponse> {
    const booking = await this.bookingsRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Reserva no encontrada.');

    await this.bookingsRepo.remove(booking);

    let notified = false;
    if (notify) {
      notified = await this.mail.enviar(this.mail.mailCancelacion(booking)).catch(() => false);
    }
    return { ok: true, id, notified };
  }

  private isUniqueViolation(e: unknown): boolean {
    const code = e instanceof QueryFailedError ? (e as unknown as { code?: string }).code : undefined;
    return Boolean(code && UNIQUE_VIOLATION_CODES.has(code));
  }
}
