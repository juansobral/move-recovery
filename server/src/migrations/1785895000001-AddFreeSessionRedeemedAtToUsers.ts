import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFreeSessionRedeemedAtToUsers1785895000001 implements MigrationInterface {
  name = 'AddFreeSessionRedeemedAtToUsers1785895000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "free_session_redeemed_at" TIMESTAMPTZ NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "free_session_redeemed_at"`);
  }
}
