import hre from "hardhat";

async function main() {
  const {
    CONTRACT_ADDRESS,
    TO,
    TOKEN_ID,
    IPFS_CID,
    ISSUED_ON,
    EXPIRES_ON,
  } = process.env as Record<string, string | undefined>;

  if (!CONTRACT_ADDRESS) throw new Error("CONTRACT_ADDRESS missing in env");
  if (!TO) throw new Error("TO missing in env");
  if (!TOKEN_ID) throw new Error("TOKEN_ID missing in env");
  if (!IPFS_CID) throw new Error("IPFS_CID missing in env");

  const issuedOn = ISSUED_ON ? BigInt(ISSUED_ON) : BigInt(Math.floor(Date.now() / 1000));
  const expiresOn = EXPIRES_ON ? BigInt(EXPIRES_ON) : BigInt(0);

  const [issuer] = await hre.ethers.getSigners();
  console.log("Issuer:", issuer.address);

  const contract = await hre.ethers.getContractAt("AcademicCredential", CONTRACT_ADDRESS);
  const tx = await contract.mint(TO, BigInt(TOKEN_ID), IPFS_CID, issuedOn, expiresOn);
  console.log("Mint tx sent:", tx.hash);
  await tx.wait();
  console.log("Mint confirmed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});


