import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ResetPassword from "@/components/ResetPassword";

export default function ResetPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = queryParams.get('type') ?? hashParams.get('type');
    const accessToken = hashParams.get('access_token') ?? queryParams.get('access_token');
    
    console.log('ResetPasswordPage - URL hash params:', {
      type,
      hasAccessToken: !!accessToken,
      fullHash: window.location.hash
    });

    // If no recovery token, redirect to forgot password
    if (!accessToken && type !== 'recovery') {
      console.log('No recovery token found, checking for direct navigation');
      // Allow the component to check for existing session
    }
  }, [navigate]);

  return <ResetPassword />;
}
