import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFirstSessionPriceToPricingSettings1785894900000 implements MigrationInterface {
  name = 'AddFirstSessionPriceToPricingSettings1785894900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pricing_settings"
      ADD COLUMN "first_session_price_uyu" integer NOT NULL DEFAULT 300
    `);
    await queryRunner.query(`ALTER TABLE "pricing_settings" ALTER COLUMN "first_session_price_uyu" DROP DEFAULT`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pricing_settings" DROP COLUMN "first_session_price_uyu"`);
  }
}
