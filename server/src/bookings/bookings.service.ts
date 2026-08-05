import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { todayStr } from '../common/date.util';
import { SERVICIOS, SLOTS } from '../catalog/catalog.constants';
import { MailService } from '../mail/mail.service';
import { User } from '../users/entities/user.entity';
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
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
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

  async create(dto: CreateBookingDto, userId: string, mpPaymentId: string | null = null): Promise<CreateBookingResponse> {
    if (dto.date < todayStr()) throw new BadRequestException('No se puede reservar en una fecha pasada.');

    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    if (user.phone === null) throw new BadRequestException('Completá tu perfil antes de reservar.');

    const service = (SERVICIOS as readonly string[]).includes(dto.service ?? '') ? (dto.service as string) : 'Recovery Room';

    let booking: Booking;
    try {
      booking = await this.bookingsRepo.save(
        this.bookingsRepo.create({
          date: dto.date,
          time: dto.time,
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          service,
          notes: dto.notes || null,
          userId: user.id,
          mpPaymentId,
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

  findByUserAndSlot(userId: string, date: string, time: string): Promise<Booking | null> {
    return this.bookingsRepo.findOne({ where: { userId, date, time } });
  }

  private isUniqueViolation(e: unknown): boolean {
    const code = e instanceof QueryFailedError ? (e as unknown as { code?: string }).code : undefined;
    return Boolean(code && UNIQUE_VIOLATION_CODES.has(code));
  }
}
