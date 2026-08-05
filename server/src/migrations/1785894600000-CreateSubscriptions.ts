import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1785894600000 implements MigrationInterface {
  name = 'CreateSubscriptions1785894600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "plan" text NOT NULL,
        "mp_preapproval_id" text NOT NULL,
        "status" text NOT NULL,
        "current_period_start" text NOT NULL,
        "current_period_end" text NOT NULL,
        "session_credits_remaining" integer NOT NULL,
        "session_credits_total" integer NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_subscriptions_mp_preapproval_id" UNIQUE ("mp_preapproval_id"),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_subscriptions_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id")
      )
    `);
    // Acelera la resolución de "suscripción actual" (ORDER BY created_at DESC
    // filtrando por user_id y current_period_end).
    await queryRunner.query(`
      CREATE INDEX "IDX_subscriptions_user_id_created_at" ON "subscriptions" ("user_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_subscriptions_user_id_created_at"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
  }
}
