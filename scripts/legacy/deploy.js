   async function main() {
     const hre = require("hardhat");
     const [deployer] = await hre.ethers.getSigners();
     console.log("Deployer:", deployer.address);

     const Contract = await hre.ethers.getContractFactory("AcademicCredential");
     const contract = await Contract.deploy(deployer.address);
     await contract.waitForDeployment();
     const address = await contract.getAddress();

     console.log("AcademicCredential deployed to:", address);
     console.log("Remember to update your frontend .env.local with this address!");
   }

   main().catch((error) => {
     console.error("DEPLOY FAILED:", error);
     process.exitCode = 1;
   });