import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDiscountCodeSettings1785895000000 implements MigrationInterface {
  name = 'CreateDiscountCodeSettings1785895000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "discount_code_settings" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" text NOT NULL,
        "active" boolean NOT NULL DEFAULT false,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_discount_code_settings_id" PRIMARY KEY ("id")
      )
    `);
    // Fila única, inactiva hasta que un admin cargue un código real — mismo
    // patrón que pricing_settings (una sola fila, nunca vacía).
    await queryRunner.query(`INSERT INTO "discount_code_settings" ("code", "active") VALUES ('', false)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "discount_code_settings"`);
  }
}
