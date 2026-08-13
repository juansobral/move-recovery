import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePricingSettings1785894800000 implements MigrationInterface {
  name = 'CreatePricingSettings1785894800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pricing_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "standard_price_uyu" integer NOT NULL,
        "standard_price_socio_uyu" integer NOT NULL,
        "premium_price_uyu" integer NOT NULL,
        "premium_price_socio_uyu" integer NOT NULL,
        "reset_session_price_uyu" integer NOT NULL,
        "reset_session_price_socio_uyu" integer NOT NULL,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pricing_settings_id" PRIMARY KEY ("id")
      )
    `);
    // Fila única con los valores hardcodeados actuales — el comportamiento no
    // cambia hasta que se edite desde el admin.
    await queryRunner.query(`
      INSERT INTO "pricing_settings" (
        "standard_price_uyu", "standard_price_socio_uyu",
        "premium_price_uyu", "premium_price_socio_uyu",
        "reset_session_price_uyu", "reset_session_price_socio_uyu"
      ) VALUES (2400, 1200, 3840, 1920, 600, 300)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "pricing_settings"`);
  }
}
