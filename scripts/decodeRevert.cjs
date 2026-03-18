const { ethers } = require('ethers');

const errors = [
  'Soulbound()',
  'UnauthorizedInstitution()',
  'CredentialNotFound()',
  'InvalidTokenId()',
  'InstitutionNotActive()',
  'RateLimitExceeded()',
];

const selector = (sig) => ethers.id(sig).slice(0, 10);

console.log('selectors:');
errors.forEach((e) => console.log(e, selector(e)));

const revertData = '0xe2517d3f000000000000000000000000786de781116c3876d1aaa3d1590af5af174d0184990193d772e35006e4af3d68abaee0e6fcc2a81756c86cd5f6aae56a27f3c129';
console.log('revert selector:', revertData.slice(0, 10));
