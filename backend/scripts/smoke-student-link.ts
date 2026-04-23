import { PrismaClient } from "@prisma/client";
import { Wallet } from "ethers";

const API_BASE = process.env.SMOKE_API_BASE || "http://localhost:9999";
const prisma = new PrismaClient();

type CredentialsAuthResponse = {
  id: string;
  email: string;
  name?: string;
  role: string;
};

async function main() {
  const suffix = Date.now();
  const email = `smoke.student.${suffix}@example.com`;
  const wallet = Wallet.createRandom();
  const password = "StrongPass!123";
  const name = "Smoke Student";

  console.log("Running smoke test...");
  console.log(`API base: ${API_BASE}`);
  console.log(`Email: ${email}`);
  console.log(`Wallet: ${wallet.address}`);

  const health = await fetch(`${API_BASE}/health`);
  if (!health.ok) {
    throw new Error(`Health check failed: ${health.status}`);
  }
  console.log("1/4 Health check passed");

  const signupRes = await fetch(`${API_BASE}/api/users/credentials-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "signup",
      authMode: "signup",
      email,
      password,
      name,
      role: "student",
      walletAddress: wallet.address,
    }),
  });

  if (!signupRes.ok) {
    const body = await signupRes.text();
    throw new Error(`Signup failed: ${signupRes.status} ${body}`);
  }

  const signupData = (await signupRes.json()) as CredentialsAuthResponse;
  if (!signupData?.id || signupData.role !== "student") {
    throw new Error("Signup response malformed");
  }
  console.log("2/4 Student signup passed");

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { institution: true, studentProfile: true },
  });

  if (!user) {
    throw new Error("User not found in DB");
  }
  if (!user.institution || user.institution.name !== "Meru University of Science and Technology") {
    throw new Error("User not linked to Meru University of Science and Technology");
  }
  console.log("3/4 User linked to Meru institution");

  const studentProfile = await prisma.studentProfile.findFirst({
    where: {
      userId: user.id,
      institutionId: user.institutionId || undefined,
      deletedAt: null,
    },
  });

  if (!studentProfile) {
    throw new Error("StudentProfile missing for newly signed-up student");
  }
  console.log("4/4 StudentProfile linkage passed");

  console.log("Smoke test passed");
}

main()
  .catch((err) => {
    console.error("Smoke test failed:", err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

