// DataSource usado por la CLI de TypeORM (migration:generate/run/revert) y por
// el script de seed. Fuera del ciclo de vida de Nest, así que lee `process.env`
// directamente en vez de ConfigService (que solo existe dentro del DI container).
import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

// Un solo .env en la raíz del repo (server/ es un workspace, no un proyecto
// aparte) — se resuelve explícito para que funcione sin importar desde qué
// directorio se invoque la CLI de TypeORM.
loadEnv({ path: resolve(__dirname, '../../.env') });
import { AdminUser } from './auth/entities/admin-user.entity';
import { Booking } from './bookings/entities/booking.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [AdminUser, Booking],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
});

export default AppDataSource;
