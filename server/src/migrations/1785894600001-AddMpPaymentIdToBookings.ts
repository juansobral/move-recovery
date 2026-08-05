import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMpPaymentIdToBookings1785894600001 implements MigrationInterface {
  name = 'AddMpPaymentIdToBookings1785894600001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" ADD COLUMN "mp_payment_id" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "mp_payment_id"`);
  }
}
