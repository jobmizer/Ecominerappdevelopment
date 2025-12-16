import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Coins, Video, Users, Wallet, TrendingUp, Copy, LogOut, Shield, Zap, Pause, Play, Check } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { RewardedAdModal } from './RewardedAdModal';

interface MiningDashboardProps {
  accessToken: string;
  userId: string;
  onLogout: () => void;
}

interface UserData {
  balance: number;
  currentMiningRate: number;
  adsWatchedToday: number;
  maxAdsPerDay: number;
  referralCode: string;
  name: string;
  totalMined: number;
  referralCount: number;
  canWithdraw: boolean;
  withdrawEligibleAt: number;
}

export function MiningDashboard({ accessToken, userId, onLogout }: MiningDashboardProps) {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [balance, setBalance] = useState(0);
  const [isMining, setIsMining] = useState(true);
  const [timeUntilReset, setTimeUntilReset] = useState(0);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('100');
  const [ecocashNumber, setEcocashNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const miningIntervalRef = useRef<number | null>(null);

  const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-4b630b24`;

  // Fetch user profile
  const fetchProfile = async () => {
    try {
      const response = await fetch(`${serverUrl}/profile`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUserData({
          balance: data.user.balance,
          currentMiningRate: data.user.currentMiningRate,
          adsWatchedToday: data.user.adsWatchedToday,
          maxAdsPerDay: data.user.depositBoostCap,
          referralCode: data.user.referralCode,
          name: data.user.name,
          totalMined: data.user.totalMined,
          referralCount: data.user.referralCount || 0,
          canWithdraw: Date.now() >= data.user.withdrawEligibleAt,
          withdrawEligibleAt: data.user.withdrawEligibleAt,
        });
        setBalance(data.user.balance);
        setFullName(data.user.name);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Update mining status
  const updateMiningStatus = async () => {
    try {
      const response = await fetch(`${serverUrl}/mining-status`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setBalance(data.balance);
        setTimeUntilReset(data.timeUntilReset);
        setUserData(prev => prev ? {
          ...prev,
          currentMiningRate: data.currentMiningRate,
          adsWatchedToday: data.adsWatchedToday,
          maxAdsPerDay: data.maxAdsPerDay,
        } : null);
      }
    } catch (error) {
      console.error('Error updating mining status:', error);
    }
  };

  // Local mining simulation (updates balance locally, syncs with server periodically)
  useEffect(() => {
    if (isMining && userData) {
      miningIntervalRef.current = window.setInterval(() => {
        setBalance(prev => prev + userData.currentMiningRate);
      }, 1000);
    } else {
      if (miningIntervalRef.current) {
        clearInterval(miningIntervalRef.current);
      }
    }

    return () => {
      if (miningIntervalRef.current) {
        clearInterval(miningIntervalRef.current);
      }
    };
  }, [isMining, userData?.currentMiningRate]);

  // Sync with server every 10 seconds
  useEffect(() => {
    fetchProfile();
    const syncInterval = setInterval(updateMiningStatus, 10000);
    return () => clearInterval(syncInterval);
  }, []);

  // Watch ad handler
  const handleWatchAd = async () => {
    if (!userData || userData.adsWatchedToday >= userData.maxAdsPerDay) {
      toast.error('Daily ad limit reached!');
      return;
    }

    setShowAdModal(true);
  };

  // Handle ad completion
  const handleAdComplete = async () => {
    setIsWatchingAd(true);

    try {
      const response = await fetch(`${serverUrl}/watch-ad`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Mining speed boosted! +$0.000001/sec`);
        setUserData(prev => prev ? {
          ...prev,
          currentMiningRate: data.newMiningRate,
          adsWatchedToday: data.adsWatchedToday,
        } : null);
        setBalance(data.balance);
      } else {
        toast.error(data.error || 'Failed to watch ad');
      }
    } catch (error) {
      console.error('Error watching ad:', error);
      toast.error('Failed to watch ad');
    } finally {
      setIsWatchingAd(false);
    }
  };

  // Apply referral code
  const handleApplyReferral = async () => {
    if (!referralCode.trim()) {
      toast.error('Please enter a referral code');
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/apply-referral`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ referralCode: referralCode.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Referral code applied successfully!');
        setReferralCode('');
        fetchProfile();
      } else {
        toast.error(data.error || 'Failed to apply referral code');
      }
    } catch (error) {
      console.error('Error applying referral code:', error);
      toast.error('Failed to apply referral code');
    }
  };

  // Copy referral code
  const handleCopyReferralCode = () => {
    if (userData?.referralCode) {
      navigator.clipboard.writeText(userData.referralCode);
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Request withdrawal
  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);

    if (amount < 100) {
      toast.error('Minimum withdrawal is $100');
      return;
    }

    if (!userData?.canWithdraw) {
      const daysLeft = Math.ceil((userData!.withdrawEligibleAt - Date.now()) / (24 * 60 * 60 * 1000));
      toast.error(`Must wait ${daysLeft} more days before first withdrawal`);
      return;
    }

    if (!ecocashNumber || !fullName) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      const response = await fetch(`${serverUrl}/request-withdrawal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount, ecocashNumber, fullName }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Withdrawal request submitted!');
        setWithdrawAmount('100');
        setEcocashNumber('');
        fetchProfile();
      } else {
        toast.error(data.error || 'Failed to request withdrawal');
      }
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
      toast.error('Failed to request withdrawal');
    }
  };

  const formatTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (!userData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your mining dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Coins className="size-6 text-emerald-600" />
            </div>
            <div>
              <h1>Eco.Miner</h1>
              <p className="text-sm text-gray-600">Welcome, {userData.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="size-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Balance Card */}
        <Card className="mb-6 bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-0">
          <CardHeader>
            <CardDescription className="text-emerald-100">Total Balance</CardDescription>
            <CardTitle className="text-4xl">${balance.toFixed(6)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-emerald-100">
              <Zap className="size-4" />
              <span>Mining at ${userData.currentMiningRate.toFixed(6)}/sec</span>
            </div>
            <div className="mt-4 flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsMining(!isMining)}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                {isMining ? (
                  <>
                    <Pause className="size-4 mr-2" />
                    Pause Mining
                  </>
                ) : (
                  <>
                    <Play className="size-4 mr-2" />
                    Resume Mining
                  </>
                )}
              </Button>
              {isMining && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="size-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span>Active</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Mined</CardDescription>
              <CardTitle className="text-2xl">${userData.totalMined.toFixed(6)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Ads Watched Today</CardDescription>
              <CardTitle className="text-2xl">
                {userData.adsWatchedToday}/{userData.maxAdsPerDay}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Reset In</CardDescription>
              <CardTitle className="text-2xl">{formatTime(timeUntilReset)}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="boost" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="boost">
              <Video className="size-4 mr-2" />
              Boost
            </TabsTrigger>
            <TabsTrigger value="referral">
              <Users className="size-4 mr-2" />
              Referral
            </TabsTrigger>
            <TabsTrigger value="wallet">
              <Wallet className="size-4 mr-2" />
              Wallet
            </TabsTrigger>
          </TabsList>

          {/* Boost Tab */}
          <TabsContent value="boost" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Watch Ads to Boost Mining</CardTitle>
                <CardDescription>
                  Each ad increases your mining speed by $0.000001/sec for 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Daily Progress</span>
                    <span>{userData.adsWatchedToday}/{userData.maxAdsPerDay} ads</span>
                  </div>
                  <Progress 
                    value={(userData.adsWatchedToday / userData.maxAdsPerDay) * 100} 
                  />
                </div>

                <Button
                  onClick={handleWatchAd}
                  disabled={isWatchingAd || userData.adsWatchedToday >= userData.maxAdsPerDay}
                  className="w-full"
                  size="lg"
                >
                  {isWatchingAd ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Watching Ad...
                    </>
                  ) : userData.adsWatchedToday >= userData.maxAdsPerDay ? (
                    'Daily Limit Reached'
                  ) : (
                    <>
                      <Video className="size-5 mr-2" />
                      Watch Rewarded Ad
                    </>
                  )}
                </Button>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-900">
                    💡 Tip: Watch ads daily to maintain high mining speed. All boosts reset after 24 hours.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Referral Tab */}
          <TabsContent value="referral" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Referral Code</CardTitle>
                <CardDescription>
                  Share your code and earn bonuses when friends sign up
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={userData.referralCode}
                    readOnly
                    className="font-mono text-lg"
                  />
                  <Button onClick={handleCopyReferralCode} variant="outline">
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>

                <div className="bg-emerald-50 p-4 rounded-lg space-y-2">
                  <p className="text-sm">
                    <strong>Your Referrals:</strong> {userData.referralCount}
                  </p>
                  <p className="text-sm text-gray-700">
                    • You get 2 extra ad boosts when a friend watches 3+ ads
                  </p>
                  <p className="text-sm text-gray-700">
                    • Earn $0.05 bonus when they mine for the first time
                  </p>
                  <p className="text-sm text-gray-700">
                    • Your friend gets +$0.000003/sec boost for 24 hours
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Apply Referral Code</CardTitle>
                <CardDescription>
                  Enter a friend's referral code to get bonus mining speed
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="Enter code (e.g., ECO12345678)"
                    className="font-mono"
                  />
                  <Button onClick={handleApplyReferral}>Apply</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Wallet Tab */}
          <TabsContent value="wallet" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Withdraw Funds</CardTitle>
                <CardDescription>
                  Minimum withdrawal: $100 via Ecocash
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!userData.canWithdraw && (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                    <p className="text-sm text-yellow-900">
                      ⏳ New accounts must wait 7 days before first withdrawal.
                      You can withdraw in {Math.ceil((userData.withdrawEligibleAt - Date.now()) / (24 * 60 * 60 * 1000))} days.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="100"
                    step="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="100.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ecocash">Ecocash Number</Label>
                  <Input
                    id="ecocash"
                    value={ecocashNumber}
                    onChange={(e) => setEcocashNumber(e.target.value)}
                    placeholder="+263..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>

                <Button
                  onClick={handleWithdraw}
                  disabled={!userData.canWithdraw || balance < 100}
                  className="w-full"
                  size="lg"
                >
                  <TrendingUp className="size-5 mr-2" />
                  Request Withdrawal
                </Button>

                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700">
                  <p>ℹ️ Withdrawals are processed manually within 1-3 business days.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Rewarded Ad Modal */}
      <RewardedAdModal
        open={showAdModal}
        onClose={() => setShowAdModal(false)}
        onAdComplete={handleAdComplete}
      />
    </div>
  );
}