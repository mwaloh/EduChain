import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGET_NAMES = [
  "Meru University of Science and Technology",
  "Meru University",
];
const TARGET_CODE = "MERU001";

async function getOrCreateMeruInstitution() {
  const existing = await prisma.institution.findFirst({
    where: {
      deletedAt: null,
      OR: [{ code: TARGET_CODE }, ...TARGET_NAMES.map((name) => ({ name }))],
    },
  });

  if (existing) return existing;

  return prisma.institution.create({
    data: {
      name: "Meru University of Science and Technology",
      code: TARGET_CODE,
      status: "approved",
      active: true,
      metadataURI: "https://must.ac.ke",
    },
  });
}

async function main() {
  const meru = await getOrCreateMeruInstitution();
  const students = await prisma.user.findMany({
    where: { role: "student", deletedAt: null },
    select: { id: true, email: true, walletAddress: true, institutionId: true },
  });

  let usersLinked = 0;
  let profilesUpserted = 0;

  for (const user of students) {
    if (!user.institutionId || user.institutionId !== meru.id) {
      await prisma.user.update({
        where: { id: user.id },
        data: { institutionId: meru.id },
      });
      usersLinked++;
    }

    const existingProfile = await prisma.studentProfile.findFirst({
      where: {
        OR: [{ userId: user.id }, { email: user.email }],
        deletedAt: null,
      },
    });

    if (existingProfile) {
      await prisma.studentProfile.update({
        where: { id: existingProfile.id },
        data: {
          userId: user.id,
          institutionId: meru.id,
          email: user.email,
          walletAddress: user.walletAddress || existingProfile.walletAddress,
          status: existingProfile.status || "active",
        },
      });
      profilesUpserted++;
    } else {
      await prisma.studentProfile.create({
        data: {
          userId: user.id,
          institutionId: meru.id,
          email: user.email,
          walletAddress: user.walletAddress || null,
          status: "active",
        },
      });
      profilesUpserted++;
    }
  }

  const totalProfiles = await prisma.studentProfile.count({
    where: { institutionId: meru.id, deletedAt: null },
  });

  console.log(
    JSON.stringify(
      {
        institution: { id: meru.id, name: meru.name, code: meru.code },
        processedStudents: students.length,
        usersLinked,
        profilesUpserted,
        totalProfiles,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

