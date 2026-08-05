import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBookings1785868695227 implements MigrationInterface {
  name = 'CreateBookings1785868695227';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "bookings" (
        "id" SERIAL NOT NULL,
        "date" text NOT NULL,
        "time" text NOT NULL,
        "name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text NOT NULL,
        "service" text NOT NULL,
        "notes" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_bookings_date_time" UNIQUE ("date", "time"),
        CONSTRAINT "PK_bookings_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "bookings"`);
  }
}
