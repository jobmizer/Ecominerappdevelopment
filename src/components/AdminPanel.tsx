import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Shield, Users, DollarSign, LogOut, CheckCircle, XCircle } from 'lucide-react';
import { projectId } from '../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import logo from 'figma:asset/2978341561cf6c2a5218872dfe5a018b3a33b384.png';

interface AdminPanelProps {
  accessToken: string;
  onBack: () => void;
}

interface Withdrawal {
  userId: string;
  amount: number;
  ecocashNumber: string;
  fullName: string;
  method: string;
  status: string;
  requestedAt: number;
  processedAt: number | null;
}

export function AdminPanel({ accessToken, onBack }: AdminPanelProps) {
  const [withdrawals, setWithdrawals] = useState<Array<[string, Withdrawal]>>([]);
  const [isLoading, setIsLoading] = useState(true);

  const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-4b630b24`;

  const fetchWithdrawals = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${serverUrl}/admin/withdrawals`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setWithdrawals(data.withdrawals || []);
      } else {
        toast.error(data.error || 'Failed to fetch withdrawals');
        if (response.status === 403) {
          setTimeout(onBack, 2000);
        }
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      toast.error('Failed to fetch withdrawals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessWithdrawal = async (withdrawalId: string) => {
    try {
      const response = await fetch(`${serverUrl}/admin/process-withdrawal`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ withdrawalId }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Withdrawal marked as completed');
        fetchWithdrawals();
      } else {
        toast.error(data.error || 'Failed to process withdrawal');
      }
    } catch (error) {
      console.error('Error processing withdrawal:', error);
      toast.error('Failed to process withdrawal');
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const pendingWithdrawals = withdrawals.filter(([_, w]) => w.status === 'pending');
  const completedWithdrawals = withdrawals.filter(([_, w]) => w.status === 'completed');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Eco.Miner" className="h-12" />
            <div>
              <h1>Admin Panel</h1>
              <p className="text-sm text-gray-600">Withdrawal Management</p>
            </div>
          </div>
          <Button variant="outline" onClick={onBack}>
            Back to Dashboard
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Pending Withdrawals</CardDescription>
              <CardTitle className="text-3xl">{pendingWithdrawals.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Completed Withdrawals</CardDescription>
              <CardTitle className="text-3xl">{completedWithdrawals.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Withdrawals</CardTitle>
            <CardDescription>Review and approve withdrawal requests</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading withdrawals...</p>
              </div>
            ) : pendingWithdrawals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No pending withdrawals
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Ecocash Number</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithdrawals.map(([id, withdrawal]) => (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-xs">
                          {withdrawal.userId.substring(0, 8)}...
                        </TableCell>
                        <TableCell>{withdrawal.fullName}</TableCell>
                        <TableCell>${withdrawal.amount.toFixed(2)}</TableCell>
                        <TableCell>{withdrawal.ecocashNumber}</TableCell>
                        <TableCell>
                          {new Date(withdrawal.requestedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                            <Clock className="size-3 mr-1" />
                            Pending
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => handleProcessWithdrawal(id)}
                          >
                            <CheckCircle className="size-4 mr-1" />
                            Mark Paid
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Completed Withdrawals</CardTitle>
            <CardDescription>Recently processed withdrawals</CardDescription>
          </CardHeader>
          <CardContent>
            {completedWithdrawals.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No completed withdrawals yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Processed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedWithdrawals.map(([id, withdrawal]) => (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-xs">
                          {withdrawal.userId.substring(0, 8)}...
                        </TableCell>
                        <TableCell>{withdrawal.fullName}</TableCell>
                        <TableCell>${withdrawal.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {new Date(withdrawal.requestedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {withdrawal.processedAt
                            ? new Date(withdrawal.processedAt).toLocaleDateString()
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            <CheckCircle className="size-3 mr-1" />
                            Completed
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}