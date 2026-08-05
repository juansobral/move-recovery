// Crea (o actualiza la clave de) la primera cuenta admin. No hay flujo de
// alta de usuarios en la app — esto es lo único que crea uno.
//
//   SEED_ADMIN_EMAIL=admin@move.uy SEED_ADMIN_PASSWORD=... npm run seed:admin
//
// Idempotente: si el email ya existe, actualiza el hash de la clave.
import * as bcrypt from 'bcrypt';
import { AdminUser } from '../auth/entities/admin-user.entity';
import AppDataSource from '../data-source';

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Faltan SEED_ADMIN_EMAIL y/o SEED_ADMIN_PASSWORD.');
    process.exit(1);
  }

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(AdminUser);

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await repo.findOne({ where: { email } });

  if (existing) {
    existing.passwordHash = passwordHash;
    await repo.save(existing);
    console.log(`Clave actualizada para ${email}.`);
  } else {
    await repo.save(repo.create({ email, passwordHash }));
    console.log(`Cuenta admin creada para ${email}.`);
  }

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
