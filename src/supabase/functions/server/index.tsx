import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Initialize Supabase client with service role for admin operations
const getSupabaseAdmin = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
};

const getSupabaseUser = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  );
};

// Helper to get current server time
const getServerTime = () => Date.now();

// Helper to authenticate user
const authenticateUser = async (request: Request) => {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No access token provided', userId: null };
  }
  
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user?.id) {
    return { error: 'Unauthorized', userId: null };
  }
  
  return { error: null, userId: user.id };
};

// Helper to generate referral code
const generateReferralCode = (userId: string) => {
  return `ECO${userId.substring(0, 8).toUpperCase()}`;
};

// Health check endpoint
app.get("/make-server-4b630b24/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/make-server-4b630b24/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    console.log('Signup request received for:', email);
    
    if (!email || !password || !name) {
      console.log('Missing required fields');
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    const supabase = getSupabaseAdmin();
    console.log('Creating user with admin client...');
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.log(`Error creating user during signup: ${error.message}`, error);
      return c.json({ error: error.message }, 400);
    }
    
    console.log('User created successfully:', data.user.id);
    
    // Initialize user data
    const userId = data.user.id;
    const referralCode = generateReferralCode(userId);
    const now = getServerTime();
    
    const userData = {
      userId,
      email,
      name,
      balance: 0,
      totalMined: 0,
      baseMiningRate: 0.0000001, // $0.0000001/sec
      currentMiningRate: 0.0000001,
      adsWatchedToday: 0,
      lastAdWatchTime: 0,
      lastResetTime: now,
      miningStartTime: now,
      referralCode,
      referredBy: null,
      referralCount: 0,
      depositBoostCap: 50, // Default max 50 ads
      createdAt: now,
      canWithdraw: false, // New users must wait 7 days
      withdrawEligibleAt: now + (7 * 24 * 60 * 60 * 1000), // 7 days from now
    };
    
    console.log('Saving user data to KV store...');
    await kv.set(`user:${userId}`, userData);
    await kv.set(`referral:${referralCode}`, userId);
    
    console.log('Signup complete for user:', userId);
    return c.json({ success: true, userId, referralCode });
  } catch (err: any) {
    console.error('Signup error:', err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  }
});

// Get user profile
app.get("/make-server-4b630b24/profile", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  return c.json({ user: userData });
});

// Get current mining status
app.get("/make-server-4b630b24/mining-status", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const now = getServerTime();
  
  // Calculate mined amount since last check
  const timeDiff = (now - userData.miningStartTime) / 1000; // in seconds
  const minedAmount = userData.currentMiningRate * timeDiff;
  
  // Update balance and reset mining start time
  userData.balance += minedAmount;
  userData.totalMined += minedAmount;
  userData.miningStartTime = now;
  
  // Check if 24 hours have passed for daily reset
  const hoursSinceReset = (now - userData.lastResetTime) / (1000 * 60 * 60);
  if (hoursSinceReset >= 24) {
    userData.currentMiningRate = userData.baseMiningRate;
    userData.adsWatchedToday = 0;
    userData.lastResetTime = now;
  }
  
  await kv.set(`user:${userId}`, userData);
  
  return c.json({
    balance: userData.balance,
    currentMiningRate: userData.currentMiningRate,
    adsWatchedToday: userData.adsWatchedToday,
    maxAdsPerDay: userData.depositBoostCap,
    serverTime: now,
    timeUntilReset: 24 * 60 * 60 * 1000 - (now - userData.lastResetTime),
  });
});

// Watch ad (rewarded ad simulation)
app.post("/make-server-4b630b24/watch-ad", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const now = getServerTime();
  
  // Calculate mined amount since last check
  const timeDiff = (now - userData.miningStartTime) / 1000;
  const minedAmount = userData.currentMiningRate * timeDiff;
  userData.balance += minedAmount;
  userData.totalMined += minedAmount;
  userData.miningStartTime = now;
  
  // Check if 24 hours have passed for daily reset
  const hoursSinceReset = (now - userData.lastResetTime) / (1000 * 60 * 60);
  if (hoursSinceReset >= 24) {
    userData.currentMiningRate = userData.baseMiningRate;
    userData.adsWatchedToday = 0;
    userData.lastResetTime = now;
  }
  
  // Check if user can watch more ads
  if (userData.adsWatchedToday >= userData.depositBoostCap) {
    return c.json({ error: 'Daily ad limit reached' }, 400);
  }
  
  // Increase mining rate
  userData.currentMiningRate += 0.0000001; // +$0.0000001/sec per ad
  userData.adsWatchedToday += 1;
  userData.lastAdWatchTime = now;
  
  await kv.set(`user:${userId}`, userData);
  
  return c.json({
    success: true,
    newMiningRate: userData.currentMiningRate,
    adsWatchedToday: userData.adsWatchedToday,
    balance: userData.balance,
  });
});

// Apply referral code
app.post("/make-server-4b630b24/apply-referral", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  const { referralCode } = await c.req.json();
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  if (!referralCode) {
    return c.json({ error: 'Referral code required' }, 400);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  if (userData.referredBy) {
    return c.json({ error: 'Already used a referral code' }, 400);
  }
  
  // Get referrer user ID
  const referrerId = await kv.get(`referral:${referralCode.toUpperCase()}`);
  
  if (!referrerId) {
    return c.json({ error: 'Invalid referral code' }, 400);
  }
  
  if (referrerId === userId) {
    return c.json({ error: 'Cannot use your own referral code' }, 400);
  }
  
  // Get referrer data
  const referrerData = await kv.get(`user:${referrerId}`);
  
  if (!referrerData) {
    return c.json({ error: 'Referrer not found' }, 400);
  }
  
  // Apply referral bonuses
  userData.referredBy = referrerId;
  
  // Check if user has watched 3+ ads to trigger bonuses
  if (userData.adsWatchedToday >= 3) {
    // Give referee bonus
    userData.currentMiningRate += 0.000003; // +$0.000003/sec for 24 hours
    
    // Give referrer bonus (2 extra ad boosts)
    referrerData.currentMiningRate += 0.000002; // 2 x $0.000001/sec
    referrerData.referralCount += 1;
    
    await kv.set(`user:${referrerId}`, referrerData);
  }
  
  await kv.set(`user:${userId}`, userData);
  
  return c.json({ success: true, message: 'Referral code applied' });
});

// Check referral progress for bonuses
app.post("/make-server-4b630b24/check-referral-bonus", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  // Check if user was referred and has watched 3+ ads
  if (userData.referredBy && userData.adsWatchedToday >= 3) {
    const referrerData = await kv.get(`user:${userData.referredBy}`);
    
    if (referrerData) {
      // Check if first time mining bonus hasn't been given
      const bonusKey = `referral_bonus:${userData.referredBy}:${userId}`;
      const bonusGiven = await kv.get(bonusKey);
      
      if (!bonusGiven && userData.totalMined > 0) {
        // Give one-time $0.05 bonus to referrer
        referrerData.balance += 0.05;
        await kv.set(`user:${userData.referredBy}`, referrerData);
        await kv.set(bonusKey, true);
        
        return c.json({ success: true, bonusApplied: true });
      }
    }
  }
  
  return c.json({ success: true, bonusApplied: false });
});

// Deposit boost (increases daily ad cap)
app.post("/make-server-4b630b24/deposit-boost", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  const { amount } = await c.req.json();
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  if (!amount || amount < 2) {
    return c.json({ error: 'Minimum deposit is $2' }, 400);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  // For demo purposes, we'll simulate deposit processing
  // In production, integrate with real payment gateway
  
  // Increase daily ad cap based on deposit
  // $2 deposit = +50 ads (from 50 to 100)
  // $5 deposit = +100 ads (from 50 to 150), etc.
  const extraCap = Math.floor(amount / 2) * 50;
  userData.depositBoostCap += extraCap;
  
  await kv.set(`user:${userId}`, userData);
  
  return c.json({
    success: true,
    newDepositBoostCap: userData.depositBoostCap,
  });
});

// Request withdrawal
app.post("/make-server-4b630b24/request-withdrawal", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  const { amount, ecocashNumber, fullName } = await c.req.json();
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  if (!amount || !ecocashNumber || !fullName) {
    return c.json({ error: 'Missing required fields' }, 400);
  }
  
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  const now = getServerTime();
  
  // Check if user is eligible to withdraw (7 days passed)
  if (now < userData.withdrawEligibleAt) {
    const daysLeft = Math.ceil((userData.withdrawEligibleAt - now) / (24 * 60 * 60 * 1000));
    return c.json({ error: `Must wait ${daysLeft} more days before first withdrawal` }, 400);
  }
  
  // Check minimum threshold
  if (amount < 100) {
    return c.json({ error: 'Minimum withdrawal is $100' }, 400);
  }
  
  // Check if user has enough balance
  if (userData.balance < amount) {
    return c.json({ error: 'Insufficient balance' }, 400);
  }
  
  // Create withdrawal request
  const withdrawalId = `withdrawal:${userId}:${now}`;
  const withdrawalData = {
    userId,
    amount,
    ecocashNumber,
    fullName,
    method: 'Ecocash',
    status: 'pending',
    requestedAt: now,
    processedAt: null,
  };
  
  // Deduct from balance
  userData.balance -= amount;
  
  await kv.set(withdrawalId, withdrawalData);
  await kv.set(`user:${userId}`, userData);
  
  return c.json({
    success: true,
    withdrawalId,
    newBalance: userData.balance,
  });
});

// Get user withdrawals
app.get("/make-server-4b630b24/withdrawals", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  const withdrawals = await kv.getByPrefix(`withdrawal:${userId}:`);
  
  return c.json({ withdrawals: withdrawals || [] });
});

// Admin: Get all pending withdrawals
app.get("/make-server-4b630b24/admin/withdrawals", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  // Check if user is admin (for demo, first user or specific email)
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData || !userData.email?.includes('admin')) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  const allWithdrawals = await kv.getByPrefix('withdrawal:');
  
  return c.json({ withdrawals: allWithdrawals || [] });
});

// Admin: Process withdrawal
app.post("/make-server-4b630b24/admin/process-withdrawal", async (c) => {
  const { error, userId } = await authenticateUser(c.req.raw);
  const { withdrawalId } = await c.req.json();
  
  if (error || !userId) {
    return c.json({ error: error || 'Unauthorized' }, 401);
  }
  
  // Check if user is admin
  const userData = await kv.get(`user:${userId}`);
  
  if (!userData || !userData.email?.includes('admin')) {
    return c.json({ error: 'Admin access required' }, 403);
  }
  
  const withdrawalData = await kv.get(withdrawalId);
  
  if (!withdrawalData) {
    return c.json({ error: 'Withdrawal not found' }, 404);
  }
  
  withdrawalData.status = 'completed';
  withdrawalData.processedAt = getServerTime();
  
  await kv.set(withdrawalId, withdrawalData);
  
  return c.json({ success: true });
});

Deno.serve(app.fetch);