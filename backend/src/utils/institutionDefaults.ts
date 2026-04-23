import { PrismaClient } from '@prisma/client';

export const MERU_CANONICAL_NAME = 'Meru University of Science and Technology';
export const MERU_ALIASES = [
  'Meru University of Science and Technology',
  'Meru University',
];
export const MERU_CODE = 'MERU001';
export const MERU_LOGO = '/images/meru-university-logo.png';
export const MERU_METADATA_URI = 'https://must.ac.ke';

export async function ensureCanonicalMeruInstitution(
  prisma: PrismaClient,
  options?: { address?: string | null }
) {
  const normalizedAddress = options?.address?.trim().toLowerCase() || null;
  const existing = await prisma.institution.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { code: MERU_CODE },
        ...(normalizedAddress ? [{ address: normalizedAddress }] : []),
        ...MERU_ALIASES.map((name) => ({ name })),
      ],
    },
  });

  if (existing) {
    return prisma.institution.update({
      where: { id: existing.id },
      data: {
        name: MERU_CANONICAL_NAME,
        code: MERU_CODE,
        status: 'approved',
        active: true,
        metadataURI: existing.metadataURI || MERU_METADATA_URI,
        logoUrl: existing.logoUrl || MERU_LOGO,
        ...(normalizedAddress && !existing.address ? { address: normalizedAddress } : {}),
      },
    });
  }

  return prisma.institution.create({
    data: {
      address: normalizedAddress,
      name: MERU_CANONICAL_NAME,
      code: MERU_CODE,
      status: 'approved',
      active: true,
      metadataURI: MERU_METADATA_URI,
      logoUrl: MERU_LOGO,
    },
  });
}
