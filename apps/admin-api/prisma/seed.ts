/**
 * Seed: popula o banco com dados mock.
 * Idempotente: usa upsert pra não duplicar em re-execuções.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Customers
  const customers = [
    { name: "Maria Silva",     email: "maria@example.com",  status: "active"   as const },
    { name: "João Santos",     email: "joao@example.com",   status: "active"   as const },
    { name: "Ana Costa",       email: "ana@example.com",    status: "inactive" as const },
    { name: "Pedro Oliveira",  email: "pedro@example.com",  status: "active"   as const },
    { name: "Carla Souza",     email: "carla@example.com",  status: "active"   as const },
  ];

  for (const c of customers) {
    await prisma.customer.upsert({
      where:  { email: c.email },
      update: { name: c.name, status: c.status },
      create: c,
    });
  }

  // Products — não temos unique key natural além do id,
  // então usamos email-like deduplication via "name unique-ish" approach: deleteMany + create.
  await prisma.product.deleteMany({});
  await prisma.product.createMany({
    data: [
      { name: "Notebook Dell XPS 13",   price: "8500.00", status: "active"   },
      { name: "Mouse Logitech MX",      price: "350.00",  status: "active"   },
      { name: "Teclado Mecânico Keychron", price: "950.00", status: "active" },
      { name: "Monitor LG 27\" 4K",     price: "2200.00", status: "active"   },
      { name: "Headset Sony WH-1000XM5", price: "2400.00", status: "inactive"},
    ],
  });

  const [cCount, pCount] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
  ]);

  console.log(`✓ Seed completo: ${cCount} customers, ${pCount} products`);
}

main()
  .catch((err) => {
    console.error("✗ Seed falhou:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
