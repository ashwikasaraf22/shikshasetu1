'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

// ⬇️ Firestore for toggling callActive
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

// Dynamically import AgoraUIKit, disabling SSR
const AgoraUIKit = dynamic(
  () => import('agora-react-uikit'),
  {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-3 text-gray-600">Loading Video Interface...</p>
        </div>
    )
  }
);

export default function CallPage() {
  const [videoCall, setVideoCall] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const router = useRouter();
  const { channelName: routeChannelName } = useParams();
  const { user, loading: authLoading } = useAuth();

  const channelName = Array.isArray(routeChannelName) ? routeChannelName[0] : routeChannelName;

  // 🔔 Make sure the doubt shows callActive while in the call; clear on end
  useEffect(() => {
    if (!channelName) return;

    const markActive = async (active: boolean) => {
      try {
        await updateDoc(doc(db, 'doubts', channelName), {
          callActive: active,
        });
      } catch (e) {
        console.warn('Failed to toggle callActive:', e);
      }
    };

    // Mark active once we land here
    markActive(true);

    // Clear when leaving/unmount
    return () => {
      markActive(false);
    };
  }, [channelName]);

  useEffect(() => {
    if (authLoading) return;

    const fetchToken = async () => {
      if (user && channelName) {
        setIsLoadingToken(true);
        try {
          const response = await fetch('/api/agora-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ channelName: channelName, uid: user.uid }),
          });
          const data = await response.json();
          if (response.ok && data.token) {
            setToken(data.token);
          } else {
            console.error('Failed to fetch token:', data.error || `Status: ${response.status}`);
            alert(`Could not get call token. ${data.error || 'Please try again.'}`);
            router.push('/chat');
          }
        } catch (error) {
          console.error('Error fetching token:', error);
          alert('Could not join call due to a network error. Please try again.');
          router.push('/chat');
        } finally {
          setIsLoadingToken(false);
        }
      } else if (!user) {
        console.error("User not authenticated for call.");
        alert('You must be logged in to join a call.');
        router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      } else if (!channelName) {
        console.error("Channel name is missing from route.");
        alert('Invalid call link.');
        router.push('/chat');
      }
    };

    fetchToken();
  }, [channelName, user, authLoading, router]);

  useEffect(() => {
    if (!videoCall) {
      router.push('/chat');
    }
  }, [videoCall, router]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg font-medium text-gray-700">Authenticating...</p>
      </div>
    );
  }

  if (isLoadingToken) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <Loader2 className="h-16 w-16 animate-spin text-primary" />
        <p className="ml-4 text-lg font-medium text-gray-700">Joining call...</p>
      </div>
    );
  }

  if (!token || !user) {
       return (
          <div className="flex h-screen items-center justify-center bg-gray-100">
             <Loader2 className="h-16 w-16 animate-spin text-primary" />
             <p className="ml-4 text-lg font-medium text-gray-700">Preparing call...</p>
          </div>
       );
   }

  return (
    <div style={{ display: 'flex', width: '100vw', height: '100vh' }}>
      {videoCall && token && user && channelName ? (
        <AgoraUIKit
          rtcProps={{
            appId: process.env.NEXT_PUBLIC_AGORA_APP_ID!,
            channel: channelName,
            token: token,
            uid: user.uid,
            role: 'publisher',
          }}
          callbacks={{
            EndCall: async () => {
              try {
                await updateDoc(doc(db, 'doubts', channelName), { callActive: false });
              } catch (e) {
                console.warn('Failed to clear callActive on EndCall:', e);
              }
              setVideoCall(false);
            },
          }}
          styleProps={{
            UIKitContainer: { height: '100%', width: '100%' },
          }}
        />
      ) : (
        <div className="flex h-screen items-center justify-center bg-gray-100">
           <p className="text-lg font-medium text-gray-700">Call ended. Redirecting...</p>
        </div>
      )}
    </div>
  );
}
