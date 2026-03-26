import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

/**
 * Validates if a domain is a valid .edu domain
 * Performs DNS MX record lookup to verify domain exists
 */
export async function validateEduDomain(domain: string): Promise<{
  isValid: boolean;
  isEdu: boolean;
  hasMxRecords: boolean;
  error?: string;
}> {
  try {
    // Basic validation
    if (!domain || typeof domain !== 'string') {
      return {
        isValid: false,
        isEdu: false,
        hasMxRecords: false,
        error: 'Domain is required'
      };
    }

    // Normalize domain (lowercase, remove www.)
    const normalizedDomain = domain.toLowerCase().replace(/^www\./, '');

    // Check if it's a .edu domain
    if (!normalizedDomain.endsWith('.edu')) {
      return {
        isValid: false,
        isEdu: false,
        hasMxRecords: false,
        error: 'Domain must be a .edu domain'
      };
    }

    // Check for MX records (email servers)
    try {
      const mxRecords = await resolveMx(normalizedDomain);
      const hasValidMx = mxRecords && mxRecords.length > 0;

      return {
        isValid: true,
        isEdu: true,
        hasMxRecords: hasValidMx,
        error: hasValidMx ? undefined : 'Domain has no MX records (no email servers)'
      };
    } catch (dnsError) {
      // DNS lookup failed - domain doesn't exist
      return {
        isValid: false,
        isEdu: true, // It's .edu but doesn't exist
        hasMxRecords: false,
        error: 'Domain does not exist or has no DNS records'
      };
    }
  } catch (error) {
    console.error('Domain validation error:', error);
    return {
      isValid: false,
      isEdu: false,
      hasMxRecords: false,
      error: 'Domain validation failed'
    };
  }
}

/**
 * Extracts domain from email address
 */
export function extractDomainFromEmail(email: string): string | null {
  if (!email || typeof email !== 'string') {
    return null;
  }

  const emailRegex = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/;
  const match = email.match(emailRegex);

  return match ? match[1] : null;
}

/**
 * Validates institution email and domain
 */
export async function validateInstitutionEmail(email: string): Promise<{
  isValid: boolean;
  domain: string | null;
  domainValidation: {
    isValid: boolean;
    isEdu: boolean;
    hasMxRecords: boolean;
    error?: string;
  };
  error?: string;
}> {
  try {
    const domain = extractDomainFromEmail(email);

    if (!domain) {
      return {
        isValid: false,
        domain: null,
        domainValidation: {
          isValid: false,
          isEdu: false,
          hasMxRecords: false,
          error: 'Invalid email format'
        },
        error: 'Invalid email format'
      };
    }

    const domainValidation = await validateEduDomain(domain);

    return {
      isValid: domainValidation.isValid,
      domain,
      domainValidation,
      error: domainValidation.error
    };
  } catch (error) {
    console.error('Institution email validation error:', error);
    return {
      isValid: false,
      domain: null,
      domainValidation: {
        isValid: false,
        isEdu: false,
        hasMxRecords: false,
        error: 'Email validation failed'
      },
      error: 'Email validation failed'
    };
  }
}

/**
 * Sends domain verification email to institution
 * This is a more advanced verification where we send an email to a known address
 * at the institution (like admin@domain.edu) to confirm domain ownership
 */
export async function sendDomainVerificationEmail(
  domain: string,
  institutionName: string,
  signupId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, you might:
    // 1. Send email to admin@domain.edu
    // 2. Include a verification link
    // 3. Require manual approval from domain admin

    // For now, we'll simulate this by creating a verification record
    // In production, integrate with email service to send actual verification emails

    console.log(`[DOMAIN VERIFICATION] Would send verification email to admin@${domain} for ${institutionName}`);

    // TODO: Implement actual email sending
    // await emailService.sendDomainVerificationEmail(
    //   `admin@${domain}`,
    //   institutionName,
    //   signupId
    // );

    return { success: true };
  } catch (error) {
    console.error('Domain verification email error:', error);
    return {
      success: false,
      error: 'Failed to send domain verification email'
    };
  }
}
