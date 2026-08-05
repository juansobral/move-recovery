import { MigrationInterface, QueryRunner } from 'typeorm';

// Asume que la tabla "bookings" está vacía (no hay datos reales todavía en
// este proyecto) — si en algún momento eso deja de ser cierto, esta
// migración va a fallar de forma ruidosa en vez de corromper filas
// existentes, que es el comportamiento correcto.
export class AddUserIdToBookings1785894479939 implements MigrationInterface {
  name = 'AddUserIdToBookings1785894479939';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "bookings"
      ADD COLUMN "user_id" uuid NOT NULL,
      ADD CONSTRAINT "FK_bookings_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_user_id", DROP COLUMN "user_id"`);
  }
}
