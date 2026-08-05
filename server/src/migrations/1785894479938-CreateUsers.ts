import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsers1785894479938 implements MigrationInterface {
  name = 'CreateUsers1785894479938';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "google_id" text NOT NULL,
        "email" text NOT NULL,
        "name" text NOT NULL,
        "phone" text,
        "avatar_url" text,
        "is_socio" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_google_id" UNIQUE ("google_id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
