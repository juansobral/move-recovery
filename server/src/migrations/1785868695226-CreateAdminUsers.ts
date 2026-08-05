import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAdminUsers1785868695226 implements MigrationInterface {
  name = 'CreateAdminUsers1785868695226';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "password_hash" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_admin_users_id" PRIMARY KEY ("id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "admin_users"`);
  }
}
