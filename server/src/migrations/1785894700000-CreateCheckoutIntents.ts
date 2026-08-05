import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckoutIntents1785894700000 implements MigrationInterface {
  name = 'CreateCheckoutIntents1785894700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "checkout_intents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "payload" jsonb NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checkout_intents_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "checkout_intents"`);
  }
}
