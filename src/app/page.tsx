'use client';
import { useAccount } from 'wagmi';
import { FaCheckCircle } from 'react-icons/fa';

export default function Home() {
  const { isConnected } = useAccount();

  // Temporary placeholders — replace with your real state/hooks
  const rolesLoading = false; // TODO: replace with real loading state
  const suggestedRole = null; // TODO: replace with actual suggested role (or keep logic)

  return (
    <div>
      {isConnected && !rolesLoading && suggestedRole && (
        <div className="bg-green-600/20 border border-green-600/50 rounded-lg p-4 max-w-2xl">
          <p className="text-green-400 text-sm flex items-center gap-2 justify-center">
            <FaCheckCircle />
            {/* ... */}
          </p>
        </div>
      )}
    </div>
  );
}